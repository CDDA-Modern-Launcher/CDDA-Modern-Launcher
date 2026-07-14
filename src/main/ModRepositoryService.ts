import { mkdir, rm } from "node:fs/promises";
import { join, relative } from "node:path";

import { ipcMain, shell } from "electron";

import { Bridge } from "../shared/bridge-api/Bridge";
import { EModDeleteResult } from "../shared/mods/EModDeleteResult";
import { EModInstallResult } from "../shared/mods/EModInstallResult";
import { EModOpenFolderResult } from "../shared/mods/EModOpenFolderResult";
import { EModsCheckResult } from "../shared/mods/EModsCheckResult";
import { EModUpdateResult } from "../shared/mods/EModUpdateResult";
import { ModInfo } from "../shared/mods/ModInfo";
import { ModInstanceInfo } from "../shared/mods/ModInstanceInfo";
import { ModRepositoryState } from "../shared/mods/ModRepositoryState";
import { UpdateModOptions } from "../shared/mods/UpdateModOptions";
import { WorkspaceStatus } from "../shared/workspace/WorkspaceStatus";
import { gameBundleService } from "./GameBundleService";
import { translate } from "./LocalizationService";
import { workspaceService } from "./WorkspaceService";
import { modDeploymentService } from "./mods/ModDeploymentService";
import { fileExists } from "./mods/fileExists";
import { modGitService } from "./mods/ModGitService";
import { getChannelModRepositoryPath, getChannelModsPath, getChannelModTempPath, getModPath } from "./mods/modRepositoryPaths";
import { modRegistryStore } from "./mods/ModRegistryStore";
import { parseModSourceUrl } from "./mods/parseModSourceUrl";
import { readValidatedModInfo } from "./mods/readValidatedModInfo";
import { broadcastIPC } from "./utils/broadcastIPC";

class ModRepositoryService {
    private checking = false;

    async initialize(): Promise<void> {
        ipcMain.handle(Bridge.Mods.getState, () => this.getState());
        ipcMain.handle(Bridge.Mods.installFromUrl, (_event, url: string) => this.installFromUrl(url));
        ipcMain.handle(Bridge.Mods.checkUpdates, () => this.checkAll());
        ipcMain.handle(Bridge.Mods.update, (_event, modId: string, options?: UpdateModOptions) => this.update(modId, options));
        ipcMain.handle(Bridge.Mods.remove, (_event, modId: string) => this.remove(modId));
        ipcMain.handle(Bridge.Mods.openFolder, (_event, modId?: string) => this.openFolder(modId));

        setTimeout(() => {
            this.checkAll().catch((error) => console.error("[mods] background check failed", error));
        }, 500);
    }

    async getState(): Promise<ModRepositoryState> {
        return this.buildState();
    }

    async installFromUrl(sourceUrl: string): Promise<EModInstallResult> {
        const context = this.getReadyContext();
        if (context.status !== "ready") return { status: "error", message: context.message, state: await this.buildState() };

        let parsedSource: string;
        try {
            parsedSource = parseModSourceUrl(sourceUrl, translate);
        } catch (error) {
            return { status: "error", message: getErrorMessage(error), state: await this.buildState() };
        }

        const tempPath = join(getChannelModTempPath(context.repositoryPath, context.channelId), `install-${Date.now()}`);

        try {
            await this.prepareDirectories(context.repositoryPath, context.channelId);
            const clone = await modGitService.clone(parsedSource, tempPath);
            const validated = await readValidatedModInfo(tempPath, translate);
            const targetPath = getModPath(context.repositoryPath, context.channelId, getSafeModDirectoryName(validated.id));
            const registry = await modRegistryStore.read(context.repositoryPath, context.channelId);

            if (registry.mods[validated.id] !== undefined || (await fileExists(targetPath))) {
                throw new Error(translate("mods.error.already.installed", { id: validated.id }));
            }

            await modGitService.replaceDirectory(tempPath, targetPath);
            const now = new Date().toISOString();
            const mod: ModInfo = {
                schemaVersion: 1,
                id: validated.id,
                displayName: validated.name,
                sourceUrl: parsedSource,
                defaultBranch: clone.branch,
                trackingRef: `refs/remotes/origin/${clone.branch}`,
                installedCommit: clone.commit,
                lastKnownRemoteCommit: clone.commit,
                hasLocalChanges: false,
                updateAvailable: false,
                relativePath: relative(getChannelModRepositoryPath(context.repositoryPath, context.channelId), targetPath),
                installedAt: now,
                checkedAt: now,
                updatedAt: now,
                enabled: true
            };

            registry.mods[mod.id] = mod;
            await modRegistryStore.write(context.repositoryPath, context.channelId, registry);
            await this.synchronizeAttachments(context.repositoryPath, context.channelId, [mod]);

            const state = await this.publishState();
            return { status: "installed", state, mod: this.findItem(state, mod, context) };
        } catch (error) {
            await rm(tempPath, { recursive: true, force: true });
            return { status: "error", message: getErrorMessage(error), state: await this.buildState() };
        }
    }

    async checkAll(): Promise<EModsCheckResult> {
        if (this.checking) return { status: "checked", state: await this.buildState() };

        this.checking = true;
        await this.publishState();
        let errorMessage: string | null = null;
        let notice: { updateCount: number; dirtyCount: number } | null = null;

        try {
            const context = this.getReadyContext();
            if (context.status !== "ready") {
                errorMessage = context.message;
            } else {
                await this.prepareDirectories(context.repositoryPath, context.channelId);
                await this.cleanupTemp(context.repositoryPath, context.channelId);
                const registry = await modRegistryStore.read(context.repositoryPath, context.channelId);

                for (const mod of Object.values(registry.mods)) {
                    registry.mods[mod.id] = await this.checkOne(context.repositoryPath, context.channelId, mod);
                }

                await modRegistryStore.write(context.repositoryPath, context.channelId, registry);
                await this.synchronizeAttachments(context.repositoryPath, context.channelId, Object.values(registry.mods));

                const updateCount = Object.values(registry.mods).filter((mod) => mod.updateAvailable).length;
                const dirtyCount = Object.values(registry.mods).filter((mod) => mod.hasLocalChanges).length;
                if (updateCount > 0) notice = { updateCount, dirtyCount };
            }
        } catch (error) {
            errorMessage = getErrorMessage(error);
        } finally {
            this.checking = false;
        }

        const state = await this.publishState();
        if (notice !== null) {
            broadcastIPC(Bridge.Mods.onNotice, { type: "updates-available", ...notice, state });
        }

        return errorMessage === null ? { status: "checked", state } : { status: "error", message: errorMessage, state };
    }

    async update(modId: string, options: UpdateModOptions = {}): Promise<EModUpdateResult> {
        const context = this.getReadyContext();
        if (context.status !== "ready") return { status: "error", message: context.message, state: await this.buildState() };

        const tempPath = join(getChannelModTempPath(context.repositoryPath, context.channelId), `update-${getSafeModDirectoryName(modId)}-${Date.now()}`);

        try {
            const registry = await modRegistryStore.read(context.repositoryPath, context.channelId);
            const mod = registry.mods[modId];
            if (mod === undefined) throw new Error(translate("mods.error.not.found.in.registry"));

            const modPath = modRegistryStore.getModPath(context.repositoryPath, context.channelId, mod);
            const hasLocalChanges = (await fileExists(modPath)) && (await modGitService.hasLocalChanges(modPath));
            if (hasLocalChanges && options.force !== true) {
                const blocked = { ...mod, hasLocalChanges: true, updateAvailable: true };
                registry.mods[mod.id] = blocked;
                await modRegistryStore.write(context.repositoryPath, context.channelId, registry);
                const state = await this.publishState();
                return { status: "blocked-by-local-changes", state, mod: this.findItem(state, blocked, context) };
            }

            const clone = await modGitService.clone(mod.sourceUrl, tempPath, mod.defaultBranch);
            const validated = await readValidatedModInfo(tempPath, translate);
            if (validated.id !== mod.id) throw new Error(translate("mods.error.updated.id.mismatch", { actual: validated.id, expected: mod.id }));

            await modGitService.replaceDirectory(tempPath, modPath);
            const now = new Date().toISOString();
            const updated: ModInfo = {
                ...mod,
                displayName: validated.name,
                installedCommit: clone.commit,
                lastKnownRemoteCommit: clone.commit,
                hasLocalChanges: false,
                updateAvailable: false,
                checkedAt: now,
                updatedAt: now
            };
            registry.mods[mod.id] = updated;
            await modRegistryStore.write(context.repositoryPath, context.channelId, registry);
            await this.synchronizeAttachments(context.repositoryPath, context.channelId, [updated]);

            const state = await this.publishState();
            return { status: "updated", state, mod: this.findItem(state, updated, context) };
        } catch (error) {
            await rm(tempPath, { recursive: true, force: true });
            return { status: "error", message: getErrorMessage(error), state: await this.buildState() };
        }
    }

    async remove(modId: string): Promise<EModDeleteResult> {
        const context = this.getReadyContext();
        if (context.status !== "ready") return { status: "error", message: context.message, state: await this.buildState() };

        try {
            const registry = await modRegistryStore.read(context.repositoryPath, context.channelId);
            const mod = registry.mods[modId];
            if (mod !== undefined) {
                await modDeploymentService.detach(await this.getUserdataPaths(), mod);
                await rm(modRegistryStore.getModPath(context.repositoryPath, context.channelId, mod), { recursive: true, force: true });
                delete registry.mods[modId];
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
                : registry.mods[modId] === undefined
                  ? null
                  : modRegistryStore.getModPath(context.repositoryPath, context.channelId, registry.mods[modId]);
        if (target === null) return { status: "error", message: translate("mods.error.not.found.in.registry") };

        await mkdir(target, { recursive: true });
        const error = await shell.openPath(target);
        return error.length === 0 ? { status: "opened" } : { status: "error", message: error };
    }

    private async checkOne(repositoryPath: string, channelId: string, mod: ModInfo): Promise<ModInfo> {
        const modPath = modRegistryStore.getModPath(repositoryPath, channelId, mod);
        const now = new Date().toISOString();
        if (!(await fileExists(modPath))) return { ...(await this.restoreMissingMod(repositoryPath, channelId, mod)), checkedAt: now };

        try {
            const validated = await readValidatedModInfo(modPath, translate);
            const hasLocalChanges = await modGitService.hasLocalChanges(modPath);
            if (validated.id !== mod.id) return { ...mod, hasLocalChanges: true, checkedAt: now };

            try {
                const commits = await modGitService.fetchState(modPath, mod.defaultBranch, mod.trackingRef);
                return {
                    ...mod,
                    displayName: validated.name,
                    installedCommit: commits.localCommit,
                    lastKnownRemoteCommit: commits.remoteCommit,
                    hasLocalChanges,
                    updateAvailable: commits.localCommit !== commits.remoteCommit,
                    checkedAt: now
                };
            } catch (error) {
                console.error("[mods] failed to fetch mod", mod.id, error);
                return { ...mod, displayName: validated.name, hasLocalChanges, checkedAt: now };
            }
        } catch (error) {
            console.error("[mods] failed to check mod", mod.id, error);
            return { ...mod, checkedAt: now };
        }
    }

    private async restoreMissingMod(repositoryPath: string, channelId: string, mod: ModInfo): Promise<ModInfo> {
        const modPath = modRegistryStore.getModPath(repositoryPath, channelId, mod);
        const tempPath = join(getChannelModTempPath(repositoryPath, channelId), `restore-${getSafeModDirectoryName(mod.id)}-${Date.now()}`);

        try {
            const clone = await modGitService.clone(mod.sourceUrl, tempPath, mod.defaultBranch);
            const validated = await readValidatedModInfo(tempPath, translate);
            if (validated.id !== mod.id) throw new Error(translate("mods.error.restored.id.mismatch", { actual: validated.id, expected: mod.id }));
            await modGitService.replaceDirectory(tempPath, modPath);
            const now = new Date().toISOString();
            return { ...mod, displayName: validated.name, installedCommit: clone.commit, lastKnownRemoteCommit: clone.commit, hasLocalChanges: false, updateAvailable: false, checkedAt: now, updatedAt: now };
        } catch (error) {
            await rm(tempPath, { recursive: true, force: true });
            console.error("[mods] failed to restore missing mod", mod.id, error);
            return { ...mod, hasLocalChanges: false, updateAvailable: false };
        }
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
                mods: mods.sort((a, b) => a.displayName.localeCompare(b.displayName)),
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
            const validated = await readValidatedModInfo(absolutePath, translate);
            if (validated.id !== mod.id) return item("invalid-local-copy", translate("mods.error.local.copy.id.mismatch", { actual: validated.id, expected: mod.id }));
        } catch (error) {
            return item("invalid-local-copy", getErrorMessage(error));
        }

        if (mod.hasLocalChanges && mod.updateAvailable) return item("blocked-by-local-changes");
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

    private findItem(state: ModRepositoryState, mod: ModInfo, context: ReadyContext): ModInstanceInfo {
        return state.mods.find((item) => item.id === mod.id) ?? { ...mod, status: "installed", absolutePath: modRegistryStore.getModPath(context.repositoryPath, context.channelId, mod) };
    }

    private async prepareDirectories(repositoryPath: string, channelId: string): Promise<void> {
        await mkdir(getChannelModsPath(repositoryPath, channelId), { recursive: true });
        await mkdir(getChannelModTempPath(repositoryPath, channelId), { recursive: true });
    }

    private async cleanupTemp(repositoryPath: string, channelId: string): Promise<void> {
        await rm(getChannelModTempPath(repositoryPath, channelId), { recursive: true, force: true });
        await mkdir(getChannelModTempPath(repositoryPath, channelId), { recursive: true });
    }

    private getReadyContext(): ReadyContext | UnavailableContext {
        const workspace = workspaceService.getWorkspaceStatus();
        if (workspace.status !== "ready") return { status: "unavailable", kind: workspace.status === "unconfigured" ? "unconfigured" : "error", message: getRepositoryUnavailableMessage(workspace) };
        return { status: "ready", repositoryPath: workspace.path, channelId: workspace.selectedGameChannel.id };
    }
}

type ReadyContext = { status: "ready"; repositoryPath: string; channelId: string };
type UnavailableContext = { status: "unavailable"; kind: "unconfigured" | "error"; message: string };

function getSafeModDirectoryName(modId: string): string {
    return modId.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function getRepositoryUnavailableMessage(workspace: WorkspaceStatus): string {
    return workspace.status === "invalid" ? workspace.message : translate("mods.error.repository.unavailable");
}

export const modRepositoryService = new ModRepositoryService();
