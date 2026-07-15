import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { dialog, ipcMain, shell } from "electron";
import extract from "extract-zip";

import { Bridge } from "../shared/bridge-api/Bridge";
import { DiscoveredMod } from "../shared/mods/DiscoveredMod";
import { EModDeleteResult } from "../shared/mods/EModDeleteResult";
import { EModDiscoveryResult } from "../shared/mods/EModDiscoveryResult";
import { EModInstallResult } from "../shared/mods/EModInstallResult";
import { EModOpenFolderResult } from "../shared/mods/EModOpenFolderResult";
import { EModsCheckResult } from "../shared/mods/EModsCheckResult";
import { EModUpdateResult } from "../shared/mods/EModUpdateResult";
import { ModInfo } from "../shared/mods/ModInfo";
import { ModInstallSelection } from "../shared/mods/ModInstallSelection";
import { ModInstanceInfo } from "../shared/mods/ModInstanceInfo";
import { ModRepositoryState } from "../shared/mods/ModRepositoryState";
import { UpdateModOptions } from "../shared/mods/UpdateModOptions";
import { WorkspaceStatus } from "../shared/workspace/WorkspaceStatus";
import { gameBundleService } from "./GameBundleService";
import { translate } from "./LocalizationService";
import { workspaceService } from "./WorkspaceService";
import { modDeploymentService } from "./mods/ModDeploymentService";
import { fileExists } from "./mods/fileExists";
import { modDiscoveryService } from "./mods/ModDiscoveryService";
import { modGitService } from "./mods/ModGitService";
import { getChannelModRepositoryPath, getChannelModsPath, getChannelModTempPath } from "./mods/modRepositoryPaths";
import { modRegistryStore } from "./mods/ModRegistryStore";
import { parseModSourceUrl } from "./mods/parseModSourceUrl";
import { readValidatedModInfo } from "./mods/readValidatedModInfo";
import { broadcastIPC } from "./utils/broadcastIPC";

type PendingInstall = {
    sourceType: "git" | "archive";
    sourceId: string;
    sourceUrl?: string;
    tempPath: string;
    finalSourcePath: string;
    branch?: string;
    commit?: string;
    mods: DiscoveredMod[];
};

class ModRepositoryService {
    private checking = false;
    private readonly pendingInstalls = new Map<string, PendingInstall>();

    async initialize(): Promise<void> {
        ipcMain.handle(Bridge.Mods.getState, () => this.getState());
        ipcMain.handle(Bridge.Mods.discoverFromGit, (_event, url: string) => this.discoverFromGit(url));
        ipcMain.handle(Bridge.Mods.discoverFromArchive, () => this.discoverFromArchive());
        ipcMain.handle(Bridge.Mods.installFromFolder, () => this.installFromFolder());
        ipcMain.handle(Bridge.Mods.installSelection, (_event, selection: ModInstallSelection) => this.installSelection(selection));
        ipcMain.handle(Bridge.Mods.checkUpdates, () => this.checkAll());
        ipcMain.handle(Bridge.Mods.update, (_event, modId: string, options?: UpdateModOptions) => this.update(modId, options));
        ipcMain.handle(Bridge.Mods.remove, (_event, modId: string) => this.remove(modId));
        ipcMain.handle(Bridge.Mods.openFolder, (_event, modId?: string) => this.openFolder(modId));
        setTimeout(() => void this.checkAll(), 500);
    }

    async getState(): Promise<ModRepositoryState> {
        return this.buildState();
    }

    async discoverFromGit(sourceUrl: string): Promise<EModDiscoveryResult> {
        const context = this.getReadyContext();
        if (context.status !== "ready") return this.discoveryError(context.message);

        let tempPath: string | undefined;
        try {
            const parsedSource = parseModSourceUrl(sourceUrl, translate);
            await this.prepareDirectories(context.repositoryPath, context.channelId);
            const sourceId = randomUUID();
            tempPath = join(getChannelModTempPath(context.repositoryPath, context.channelId), sourceId);
            const clone = await modGitService.clone(parsedSource, tempPath);
            const mods = await modDiscoveryService.discover(tempPath);
            return await this.finalizeDiscovery({ sourceType: "git", sourceId, sourceUrl: parsedSource, tempPath, finalSourcePath: join("sources", sourceId), branch: clone.branch, commit: clone.commit, mods });
        } catch (error) {
            if (tempPath !== undefined) await rm(tempPath, { recursive: true, force: true });
            return this.discoveryError(getErrorMessage(error));
        }
    }

    async discoverFromArchive(): Promise<EModDiscoveryResult> {
        const context = this.getReadyContext();
        if (context.status !== "ready") return this.discoveryError(context.message);
        const selected = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "Archives", extensions: ["zip"] }] });
        if (selected.canceled || selected.filePaths.length === 0) return { status: "cancelled", state: await this.buildState() };

        let tempPath: string | undefined;
        try {
            await this.prepareDirectories(context.repositoryPath, context.channelId);
            const sourceId = randomUUID();
            tempPath = join(getChannelModTempPath(context.repositoryPath, context.channelId), sourceId);
            await mkdir(tempPath, { recursive: true });
            await extract(selected.filePaths[0], { dir: tempPath });
            const mods = await modDiscoveryService.discover(tempPath);
            return await this.finalizeDiscovery({ sourceType: "archive", sourceId, tempPath, finalSourcePath: join("sources", sourceId), mods });
        } catch (error) {
            if (tempPath !== undefined) await rm(tempPath, { recursive: true, force: true });
            return this.discoveryError(getErrorMessage(error));
        }
    }

    async installFromFolder(): Promise<EModInstallResult> {
        const context = this.getReadyContext();
        if (context.status !== "ready") return { status: "error", message: context.message, state: await this.buildState() };
        const selected = await dialog.showOpenDialog({ properties: ["openDirectory"] });
        if (selected.canceled || selected.filePaths.length === 0) return { status: "cancelled", state: await this.buildState() };
        try {
            const folderPath = selected.filePaths[0];
            const info = await readValidatedModInfo(folderPath, translate);
            const registry = await modRegistryStore.read(context.repositoryPath, context.channelId);
            this.ensureIdsAvailable(registry.mods, [info.id]);
            const now = new Date().toISOString();
            registry.mods[info.id] = {
                schemaVersion: 2,
                id: info.id,
                displayName: info.name,
                description: info.description,
                sourceType: "folder",
                sourceId: randomUUID(),
                sourcePath: folderPath,
                subdirectory: "",
                hasLocalChanges: false,
                hasUnpushedCommits: false,
                updateAvailable: false,
                installedAt: now,
                checkedAt: now,
                updatedAt: now,
                enabled: true
            };
            await modRegistryStore.write(context.repositoryPath, context.channelId, registry);
            await this.synchronizeAttachments(context.repositoryPath, context.channelId, [registry.mods[info.id]]);
            return { status: "installed", state: await this.publishState() };
        } catch (error) {
            return { status: "error", message: getErrorMessage(error), state: await this.buildState() };
        }
    }

    async installSelection(selection: ModInstallSelection): Promise<EModInstallResult> {
        const context = this.getReadyContext();
        const pending = this.pendingInstalls.get(selection.sessionId);
        if (context.status !== "ready" || pending === undefined)
            return { status: "error", message: context.status === "ready" ? translate("mods.error.install.session.expired") : context.message, state: await this.buildState() };
        try {
            const selectedMods = pending.mods.filter((mod) => selection.modIds.includes(mod.id));
            if (selectedMods.length === 0) throw new Error(translate("mods.error.no.mods.selected"));
            const registry = await modRegistryStore.read(context.repositoryPath, context.channelId);
            this.ensureIdsAvailable(
                registry.mods,
                selectedMods.map((mod) => mod.id)
            );
            const now = new Date().toISOString();
            const installed: ModInfo[] = [];

            if (pending.sourceType === "git") {
                const sourceAbsolutePath = join(getChannelModRepositoryPath(context.repositoryPath, context.channelId), pending.finalSourcePath);
                await modGitService.replaceDirectory(pending.tempPath, sourceAbsolutePath);
                for (const found of selectedMods) {
                    installed.push({
                        schemaVersion: 2,
                        id: found.id,
                        displayName: found.name,
                        description: found.description,
                        sourceType: "git",
                        sourceId: pending.sourceId,
                        sourceUrl: pending.sourceUrl,
                        sourcePath: pending.finalSourcePath,
                        subdirectory: found.subdirectory,
                        defaultBranch: pending.branch,
                        trackingRef: pending.branch ? `refs/remotes/origin/${pending.branch}` : undefined,
                        installedCommit: pending.commit,
                        lastKnownRemoteCommit: pending.commit,
                        hasLocalChanges: false,
                        hasUnpushedCommits: false,
                        updateAvailable: false,
                        installedAt: now,
                        checkedAt: now,
                        updatedAt: now,
                        enabled: true
                    });
                }
            } else {
                for (const found of selectedMods) {
                    const sourceId = randomUUID();
                    const sourcePath = join("sources", sourceId);
                    const sourceAbsolutePath = join(getChannelModRepositoryPath(context.repositoryPath, context.channelId), sourcePath);
                    await cp(join(pending.tempPath, found.subdirectory), sourceAbsolutePath, { recursive: true });
                    installed.push({
                        schemaVersion: 2,
                        id: found.id,
                        displayName: found.name,
                        description: found.description,
                        sourceType: "archive",
                        sourceId,
                        sourcePath,
                        subdirectory: "",
                        hasLocalChanges: false,
                        hasUnpushedCommits: false,
                        updateAvailable: false,
                        installedAt: now,
                        checkedAt: now,
                        updatedAt: now,
                        enabled: true
                    });
                }
                await rm(pending.tempPath, { recursive: true, force: true });
            }

            for (const mod of installed) registry.mods[mod.id] = mod;
            await modRegistryStore.write(context.repositoryPath, context.channelId, registry);
            await this.synchronizeAttachments(context.repositoryPath, context.channelId, installed);
            this.pendingInstalls.delete(selection.sessionId);
            return { status: "installed", state: await this.publishState() };
        } catch (error) {
            return { status: "error", message: getErrorMessage(error), state: await this.buildState() };
        }
    }

    async checkAll(): Promise<EModsCheckResult> {
        if (this.checking) return { status: "checked", state: await this.buildState() };
        this.checking = true;
        await this.publishState();
        let errorMessage: string | null = null;
        try {
            const context = this.getReadyContext();
            if (context.status !== "ready") throw new Error(context.message);
            const registry = await modRegistryStore.read(context.repositoryPath, context.channelId);
            const gitSources = new Map<string, ModInfo[]>();
            for (const mod of Object.values(registry.mods)) {
                if (mod.sourceType === "git") gitSources.set(mod.sourceId, [...(gitSources.get(mod.sourceId) ?? []), mod]);
                else registry.mods[mod.id] = await this.refreshMetadata(context.repositoryPath, context.channelId, mod);
            }
            for (const mods of gitSources.values()) await this.checkGitSource(context.repositoryPath, context.channelId, mods, registry.mods);
            await modRegistryStore.write(context.repositoryPath, context.channelId, registry);
            await this.synchronizeAttachments(context.repositoryPath, context.channelId, Object.values(registry.mods));
        } catch (error) {
            errorMessage = getErrorMessage(error);
        } finally {
            this.checking = false;
        }
        const state = await this.publishState();
        return errorMessage === null ? { status: "checked", state } : { status: "error", message: errorMessage, state };
    }

    async update(modId: string, options: UpdateModOptions = {}): Promise<EModUpdateResult> {
        const context = this.getReadyContext();
        if (context.status !== "ready") return { status: "error", message: context.message, state: await this.buildState() };
        const registry = await modRegistryStore.read(context.repositoryPath, context.channelId);
        const mod = registry.mods[modId];
        if (mod === undefined || mod.sourceType !== "git" || !mod.sourceUrl || !mod.defaultBranch) return { status: "error", message: translate("mods.error.update.unsupported"), state: await this.buildState() };
        const related = Object.values(registry.mods).filter((item) => item.sourceId === mod.sourceId);
        const sourcePath = modRegistryStore.getSourcePath(context.repositoryPath, context.channelId, mod);
        try {
            const sourceExists = await fileExists(sourcePath);
            const dirty = sourceExists && (await modGitService.hasLocalChanges(sourcePath));
            const unpushed = sourceExists && (await modGitService.hasUnpushedCommits(sourcePath, mod.trackingRef));
            if ((dirty || unpushed) && options.force !== true) {
                for (const item of related) registry.mods[item.id] = { ...item, hasLocalChanges: dirty, hasUnpushedCommits: unpushed };
                await modRegistryStore.write(context.repositoryPath, context.channelId, registry);
                const state = await this.publishState();
                return { status: "blocked-by-local-changes", state, mod: state.mods.find((item) => item.id === mod.id)! };
            }
            const tempPath = join(getChannelModTempPath(context.repositoryPath, context.channelId), `update-${mod.sourceId}`);
            const clone = await modGitService.clone(mod.sourceUrl, tempPath, mod.defaultBranch);
            const discovered = await modDiscoveryService.discover(tempPath);
            for (const item of related) if (!discovered.some((found) => found.id === item.id)) throw new Error(translate("mods.error.updated.mod.missing", { id: item.id }));
            await modGitService.replaceDirectory(tempPath, sourcePath);
            const now = new Date().toISOString();
            for (const item of related) {
                const found = discovered.find((candidate) => candidate.id === item.id)!;
                registry.mods[item.id] = {
                    ...item,
                    displayName: found.name,
                    description: found.description,
                    subdirectory: found.subdirectory,
                    installedCommit: clone.commit,
                    lastKnownRemoteCommit: clone.commit,
                    hasLocalChanges: false,
                    hasUnpushedCommits: false,
                    updateAvailable: false,
                    checkedAt: now,
                    updatedAt: now
                };
            }
            await modRegistryStore.write(context.repositoryPath, context.channelId, registry);
            await this.synchronizeAttachments(
                context.repositoryPath,
                context.channelId,
                related.map((item) => registry.mods[item.id])
            );
            const state = await this.publishState();
            return { status: "updated", state, mod: state.mods.find((item) => item.id === mod.id)! };
        } catch (error) {
            return { status: "error", message: getErrorMessage(error), state: await this.buildState() };
        }
    }

    async remove(modId: string): Promise<EModDeleteResult> {
        const context = this.getReadyContext();
        if (context.status !== "ready") return { status: "error", message: context.message, state: await this.buildState() };
        try {
            const registry = await modRegistryStore.read(context.repositoryPath, context.channelId);
            const mod = registry.mods[modId];
            if (mod) {
                await modDeploymentService.detach(await this.getUserdataPaths(), mod);
                delete registry.mods[modId];
                const sourceStillUsed = Object.values(registry.mods).some((item) => item.sourceId === mod.sourceId);
                if (!sourceStillUsed && mod.sourceType !== "folder") await rm(modRegistryStore.getSourcePath(context.repositoryPath, context.channelId, mod), { recursive: true, force: true });
                await modRegistryStore.write(context.repositoryPath, context.channelId, registry);
            }
            return { status: "deleted", state: await this.publishState() };
        } catch (error) {
            return { status: "error", message: getErrorMessage(error), state: await this.buildState() };
        }
    }

    async openFolder(modId?: string): Promise<EModOpenFolderResult> {
        const context = this.getReadyContext();
        if (context.status !== "ready") return { status: "error", message: context.message };
        const registry = await modRegistryStore.read(context.repositoryPath, context.channelId);
        const target =
            modId === undefined
                ? getChannelModRepositoryPath(context.repositoryPath, context.channelId)
                : registry.mods[modId]
                  ? modRegistryStore.getModPath(context.repositoryPath, context.channelId, registry.mods[modId])
                  : null;
        if (target === null) return { status: "error", message: translate("mods.error.not.found.in.registry") };
        const error = await shell.openPath(target);
        return error ? { status: "error", message: error } : { status: "opened" };
    }

    private async finalizeDiscovery(pending: PendingInstall): Promise<EModDiscoveryResult> {
        const sessionId = randomUUID();
        this.pendingInstalls.set(sessionId, pending);
        if (pending.mods.length === 1) {
            const result = await this.installSelection({ sessionId, modIds: [pending.mods[0].id] });
            return result.status === "installed"
                ? { status: "installed", state: result.state }
                : { status: "error", message: result.status === "error" ? result.message : translate("mods.error.selection.cancelled"), state: result.state };
        }
        return { status: "selection-required", sessionId, mods: pending.mods, state: await this.buildState() };
    }

    private async checkGitSource(repositoryPath: string, channelId: string, mods: ModInfo[], target: Record<string, ModInfo>): Promise<void> {
        const first = mods[0];
        const sourcePath = modRegistryStore.getSourcePath(repositoryPath, channelId, first);
        const now = new Date().toISOString();
        if (!(await fileExists(sourcePath)) || !first.defaultBranch || !first.trackingRef) return;
        const dirty = await modGitService.hasLocalChanges(sourcePath);
        let commits: { localCommit: string; remoteCommit: string; hasUnpushedCommits: boolean; updateAvailable: boolean } | undefined;
        try {
            commits = await modGitService.fetchState(sourcePath, first.defaultBranch, first.trackingRef);
        } catch (error) {
            console.error("[mods] git check failed", error);
        }
        for (const mod of mods) {
            const refreshed = await this.refreshMetadata(repositoryPath, channelId, mod);
            target[mod.id] = {
                ...refreshed,
                installedCommit: commits?.localCommit ?? mod.installedCommit,
                lastKnownRemoteCommit: commits?.remoteCommit ?? mod.lastKnownRemoteCommit,
                hasLocalChanges: dirty,
                hasUnpushedCommits: commits?.hasUnpushedCommits ?? mod.hasUnpushedCommits,
                updateAvailable: commits?.updateAvailable ?? mod.updateAvailable,
                checkedAt: now
            };
        }
    }

    private async refreshMetadata(repositoryPath: string, channelId: string, mod: ModInfo): Promise<ModInfo> {
        try {
            const info = await readValidatedModInfo(modRegistryStore.getModPath(repositoryPath, channelId, mod), translate);
            return info.id === mod.id ? { ...mod, displayName: info.name, description: info.description, checkedAt: new Date().toISOString() } : mod;
        } catch {
            return mod;
        }
    }

    private ensureIdsAvailable(installed: Record<string, ModInfo>, ids: string[]): void {
        for (const id of ids) if (installed[id]) throw new Error(translate("mods.error.already.installed", { id }));
    }

    private async discoveryError(message: string): Promise<EModDiscoveryResult> {
        return { status: "error", message, state: await this.buildState() };
    }

    private async buildState(): Promise<ModRepositoryState> {
        const context = this.getReadyContext();
        if (context.status !== "ready") return { status: context.kind, mods: [], checking: this.checking, message: context.message };
        try {
            await this.prepareDirectories(context.repositoryPath, context.channelId);
            const registry = await modRegistryStore.read(context.repositoryPath, context.channelId);
            const mods = await Promise.all(Object.values(registry.mods).map((mod) => this.buildItem(context.repositoryPath, context.channelId, mod)));
            return {
                status: "ready",
                repositoryPath: context.repositoryPath,
                channelId: context.channelId,
                modRepositoryPath: getChannelModRepositoryPath(context.repositoryPath, context.channelId),
                mods,
                checking: this.checking
            };
        } catch (error) {
            return { status: "error", mods: [], checking: this.checking, message: getErrorMessage(error) };
        }
    }

    private async buildItem(repositoryPath: string, channelId: string, mod: ModInfo): Promise<ModInstanceInfo> {
        const absolutePath = modRegistryStore.getModPath(repositoryPath, channelId, mod);
        const item = (status: ModInstanceInfo["status"], error?: string): ModInstanceInfo => ({ ...mod, status, absolutePath, error });
        if (!(await fileExists(absolutePath))) return item("missing-local-copy");
        try {
            const info = await readValidatedModInfo(absolutePath, translate);
            if (info.id !== mod.id) return item("invalid-local-copy");
        } catch (error) {
            return item("invalid-local-copy", getErrorMessage(error));
        }
        if (mod.hasLocalChanges || mod.hasUnpushedCommits) return item("blocked-by-local-changes");
        if (mod.updateAvailable) return item("update-available");
        return item("installed");
    }

    private async synchronizeAttachments(repositoryPath: string, channelId: string, mods: ModInfo[]): Promise<void> {
        await modDeploymentService.synchronizeMods(repositoryPath, channelId, await this.getUserdataPaths(), mods);
    }
    private async getUserdataPaths(): Promise<string[]> {
        return (await gameBundleService.getGameBundles()).map((bundle) => bundle.userdataPath);
    }
    private async publishState(): Promise<ModRepositoryState> {
        const state = await this.buildState();
        broadcastIPC(Bridge.Mods.onChanged, { state });
        return state;
    }
    private async prepareDirectories(repositoryPath: string, channelId: string): Promise<void> {
        await mkdir(getChannelModsPath(repositoryPath, channelId), { recursive: true });
        await mkdir(getChannelModTempPath(repositoryPath, channelId), { recursive: true });
        await mkdir(join(getChannelModRepositoryPath(repositoryPath, channelId), "sources"), { recursive: true });
    }
    private getReadyContext(): ReadyContext | UnavailableContext {
        const workspace = workspaceService.getWorkspaceStatus();
        if (workspace.status !== "ready") return { status: "unavailable", kind: workspace.status === "unconfigured" ? "unconfigured" : "error", message: getRepositoryUnavailableMessage(workspace) };
        return { status: "ready", repositoryPath: workspace.path, channelId: workspace.selectedGameChannel.id };
    }
}

type ReadyContext = { status: "ready"; repositoryPath: string; channelId: string };
type UnavailableContext = { status: "unavailable"; kind: "unconfigured" | "error"; message: string };
function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
function getRepositoryUnavailableMessage(workspace: WorkspaceStatus): string {
    return workspace.status === "invalid" ? workspace.message : translate("mods.error.repository.unavailable");
}
export const modRepositoryService = new ModRepositoryService();
