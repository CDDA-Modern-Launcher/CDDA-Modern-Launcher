import * as fs from "node:fs";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import { ipcMain, shell } from "electron";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

import { getChannelModRepositoryPath, getChannelModsPath, getChannelModTempPath, getModPath } from "./mods/modRepositoryPaths";
import { WorkspaceStatus } from "../shared/workspace/WorkspaceStatus";
import { ModInfo } from "../shared/mods/ModInfo";
import { ModRegistry } from "../shared/mods/ModRegistry";
import { ModInstanceInfo } from "../shared/mods/ModInstanceInfo";
import { ModRepositoryState } from "../shared/mods/ModRepositoryState";
import { EModInstallResult } from "../shared/mods/EModInstallResult";
import { EModsCheckResult } from "../shared/mods/EModsCheckResult";
import { UpdateModOptions } from "../shared/mods/UpdateModOptions";
import { EModUpdateResult } from "../shared/mods/EModUpdateResult";
import { EModDeleteResult } from "../shared/mods/EModDeleteResult";
import { EModOpenFolderResult } from "../shared/mods/EModOpenFolderResult";
import { isNodeError } from "./utils/isNodeError";
import { Bridge } from "../shared/bridge-api/Bridge";
import { normalizeModDisplayName } from "./mods/normalizeModDisplayName";
import { readValidatedModInfo } from "./mods/readValidatedModInfo";
import { parseModSourceUrl } from "./mods/parseModSourceUrl";
import { translate } from "./LocalizationService";
import { workspaceService } from "./WorkspaceService";
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
            this.checkAll().catch((error) => {
                console.error("[mods] background check failed", error);
            });
        }, 500);
    }

    async getState(): Promise<ModRepositoryState> {
        return this.buildState();
    }

    async installFromUrl(sourceUrl: string): Promise<EModInstallResult> {
        const context = await this.getReadyContext();

        if (context.status !== "ready") {
            const state = await this.buildState();
            return { status: "error", message: context.message, state };
        }

        let parsedSource: string;

        try {
            parsedSource = parseModSourceUrl(sourceUrl, this.t);
        } catch (error) {
            const state = await this.buildState();
            return { status: "error", message: getErrorMessage(error), state };
        }

        const tempDir = join(getChannelModTempPath(context.repositoryPath, context.channelId), `install-${Date.now()}`);

        try {
            await this.prepareChannelDirectories(context.repositoryPath, context.channelId);
            await rm(tempDir, { recursive: true, force: true });
            await mkdir(tempDir, { recursive: true });

            await git.clone({
                fs,
                http,
                dir: tempDir,
                url: parsedSource,
                singleBranch: true,
                depth: 1
            });

            const modInfo = await readValidatedModInfo(tempDir, this.t);
            const safeModId = getSafeModDirectoryName(modInfo.id);
            const targetDir = getModPath(context.repositoryPath, context.channelId, safeModId);
            const registry = await this.readRegistry(context.repositoryPath, context.channelId);

            if (registry.mods[modInfo.id] !== undefined || (await exists(targetDir))) {
                throw new Error(this.t("mods.error.already.installed", { id: modInfo.id }));
            }

            const branch = (await git.currentBranch({ fs, dir: tempDir, fullname: false })) ?? "master";
            const installedCommit = await git.resolveRef({ fs, dir: tempDir, ref: "HEAD" });
            await mkdir(dirname(targetDir), { recursive: true });
            await fs.promises.rename(tempDir, targetDir);

            const now = new Date().toISOString();
            const installedMod: ModInfo = {
                schemaVersion: 1,
                id: modInfo.id,
                displayName: modInfo.name,
                sourceUrl: parsedSource,
                defaultBranch: branch,
                trackingRef: `refs/remotes/origin/${branch}`,
                installedCommit,
                lastKnownRemoteCommit: installedCommit,
                hasLocalChanges: false,
                updateAvailable: false,
                relativePath: relative(getChannelModRepositoryPath(context.repositoryPath, context.channelId), targetDir),
                installedAt: now,
                checkedAt: now,
                updatedAt: now,
                enabled: true
            };

            registry.mods[installedMod.id] = installedMod;
            await this.writeRegistry(context.repositoryPath, context.channelId, registry);

            const state = await this.buildState();
            broadcastIPC(Bridge.Mods.onChanged, { state: state });
            const mod = state.mods.find((item) => item.id === installedMod.id) ?? this.toItem(context.repositoryPath, context.channelId, installedMod, "installed");
            return { status: "installed", state, mod };
        } catch (error) {
            await rm(tempDir, { recursive: true, force: true });
            const state = await this.buildState();
            return { status: "error", message: getErrorMessage(error), state };
        }
    }

    async checkAll(): Promise<EModsCheckResult> {
        if (this.checking) {
            return { status: "checked", state: await this.buildState() };
        }

        this.checking = true;
        broadcastIPC(Bridge.Mods.onChanged, { state: await this.buildState() });

        let outcome: { status: "checked" } | { status: "error"; message: string } = { status: "checked" };
        let notice: { updateCount: number; dirtyCount: number } | null = null;

        try {
            const context = await this.getReadyContext();

            if (context.status !== "ready") {
                outcome = { status: "error", message: context.message };
            } else {
                await this.prepareChannelDirectories(context.repositoryPath, context.channelId);
                await this.cleanupTemp(context.repositoryPath, context.channelId);

                const registry = await this.readRegistry(context.repositoryPath, context.channelId);
                let updateCount = 0;
                let dirtyCount = 0;

                for (const mod of Object.values(registry.mods)) {
                    const checked = await this.checkOne(context.repositoryPath, context.channelId, mod);
                    registry.mods[mod.id] = checked;

                    if (checked.updateAvailable) {
                        updateCount += 1;
                    }

                    if (checked.hasLocalChanges) {
                        dirtyCount += 1;
                    }
                }

                await this.writeRegistry(context.repositoryPath, context.channelId, registry);

                if (updateCount > 0) {
                    notice = { updateCount, dirtyCount };
                }
            }
        } catch (error) {
            outcome = { status: "error", message: getErrorMessage(error) };
        }

        this.checking = false;
        const state = await this.buildState();
        broadcastIPC(Bridge.Mods.onChanged, { state: state });

        if (notice !== null) {
            broadcastIPC(Bridge.Mods.onNotice, { type: "updates-available", updateCount: notice.updateCount, dirtyCount: notice.dirtyCount, state: state });
        }

        if (outcome.status === "error") {
            return { status: "error", message: outcome.message, state };
        }

        return { status: "checked", state };
    }

    async update(modId: string, options: UpdateModOptions = {}): Promise<EModUpdateResult> {
        const context = await this.getReadyContext();

        if (context.status !== "ready") {
            const state = await this.buildState();
            return { status: "error", message: context.message, state };
        }

        try {
            const registry = await this.readRegistry(context.repositoryPath, context.channelId);
            const mod = registry.mods[modId];

            if (mod === undefined) {
                throw new Error(this.t("mods.error.not.found.in.registry"));
            }

            const modDir = this.getModDir(context.repositoryPath, context.channelId, mod);
            const hasLocalChanges = (await exists(modDir)) ? await this.hasLocalChanges(modDir) : false;

            if (hasLocalChanges && options.force !== true) {
                const blocked = { ...mod, hasLocalChanges, updateAvailable: true };
                registry.mods[mod.id] = blocked;
                await this.writeRegistry(context.repositoryPath, context.channelId, registry);
                const state = await this.buildState();
                const item = state.mods.find((entry) => entry.id === mod.id) ?? this.toItem(context.repositoryPath, context.channelId, blocked, "blocked-by-local-changes");
                return { status: "blocked-by-local-changes", state, mod: item };
            }

            const tempDir = join(getChannelModTempPath(context.repositoryPath, context.channelId), `update-${getSafeModDirectoryName(mod.id)}-${Date.now()}`);
            await rm(tempDir, { recursive: true, force: true });
            await mkdir(tempDir, { recursive: true });
            await git.clone({ fs, http, dir: tempDir, url: mod.sourceUrl, ref: mod.defaultBranch, singleBranch: true, depth: 1 });
            const modInfo = await readValidatedModInfo(tempDir, this.t);

            if (modInfo.id !== mod.id) {
                throw new Error(this.t("mods.error.updated.id.mismatch", { actual: modInfo.id, expected: mod.id }));
            }

            const nextCommit = await git.resolveRef({ fs, dir: tempDir, ref: "HEAD" });
            await rm(modDir, { recursive: true, force: true });
            await mkdir(dirname(modDir), { recursive: true });
            await fs.promises.rename(tempDir, modDir);

            const now = new Date().toISOString();
            const updatedMod: ModInfo = {
                ...mod,
                displayName: modInfo.name,
                installedCommit: nextCommit,
                lastKnownRemoteCommit: nextCommit,
                hasLocalChanges: false,
                updateAvailable: false,
                checkedAt: now,
                updatedAt: now
            };
            registry.mods[mod.id] = updatedMod;
            await this.writeRegistry(context.repositoryPath, context.channelId, registry);

            const state = await this.buildState();
            broadcastIPC(Bridge.Mods.onChanged, { state: state });
            const item = state.mods.find((entry) => entry.id === mod.id) ?? this.toItem(context.repositoryPath, context.channelId, updatedMod, "installed");
            return { status: "updated", state, mod: item };
        } catch (error) {
            const state = await this.buildState();
            return { status: "error", message: getErrorMessage(error), state };
        }
    }

    async remove(modId: string): Promise<EModDeleteResult> {
        const context = await this.getReadyContext();

        if (context.status !== "ready") {
            const state = await this.buildState();
            return { status: "error", message: context.message, state };
        }

        try {
            const registry = await this.readRegistry(context.repositoryPath, context.channelId);
            const mod = registry.mods[modId];

            if (mod !== undefined) {
                await rm(this.getModDir(context.repositoryPath, context.channelId, mod), { recursive: true, force: true });
                delete registry.mods[modId];
                await this.writeRegistry(context.repositoryPath, context.channelId, registry);
            }

            const state = await this.buildState();
            broadcastIPC(Bridge.Mods.onChanged, { state: state });
            return { status: "deleted", state };
        } catch (error) {
            const state = await this.buildState();
            return { status: "error", message: getErrorMessage(error), state };
        }
    }

    async openFolder(modId?: string): Promise<EModOpenFolderResult> {
        const context = await this.getReadyContext();

        if (context.status !== "ready") {
            return { status: "error", message: context.message };
        }

        const registry = await this.readRegistry(context.repositoryPath, context.channelId);
        const target =
            modId === undefined
                ? getChannelModRepositoryPath(context.repositoryPath, context.channelId)
                : registry.mods[modId] === undefined
                  ? null
                  : this.getModDir(context.repositoryPath, context.channelId, registry.mods[modId]);

        if (target === null) {
            return { status: "error", message: this.t("mods.error.not.found.in.registry") };
        }

        await mkdir(target, { recursive: true });
        await shell.openPath(target);
        return { status: "opened" };
    }

    private readonly t = (key: string, variables?: Record<string, string | number>): string => translate(key, variables);

    private async checkOne(repositoryPath: string, channelId: string, mod: ModInfo): Promise<ModInfo> {
        const modDir = this.getModDir(repositoryPath, channelId, mod);
        const now = new Date().toISOString();

        if (!(await exists(modDir))) {
            const restored = await this.restoreMissingMod(repositoryPath, channelId, mod);
            return { ...restored, checkedAt: now };
        }

        try {
            const modInfo = await readValidatedModInfo(modDir, this.t);
            const hasLocalChanges = await this.hasLocalChanges(modDir);

            if (modInfo.id !== mod.id) {
                return { ...mod, hasLocalChanges: true, checkedAt: now };
            }

            try {
                await git.fetch({ fs, http, dir: modDir, remote: "origin", ref: mod.defaultBranch, singleBranch: true, depth: 1 });
                const localCommit = await git.resolveRef({ fs, dir: modDir, ref: "HEAD" });
                const remoteCommit = await git.resolveRef({ fs, dir: modDir, ref: mod.trackingRef });

                return {
                    ...mod,
                    displayName: modInfo.name,
                    installedCommit: localCommit,
                    lastKnownRemoteCommit: remoteCommit,
                    hasLocalChanges,
                    updateAvailable: localCommit !== remoteCommit,
                    checkedAt: now
                };
            } catch (error) {
                console.error("[mods] failed to fetch mod", mod.id, error);
                return { ...mod, displayName: modInfo.name, hasLocalChanges, checkedAt: now };
            }
        } catch (error) {
            console.error("[mods] failed to check mod", mod.id, error);
            return { ...mod, checkedAt: now };
        }
    }

    private async restoreMissingMod(repositoryPath: string, channelId: string, mod: ModInfo): Promise<ModInfo> {
        const modDir = this.getModDir(repositoryPath, channelId, mod);
        const tempDir = join(getChannelModTempPath(repositoryPath, channelId), `restore-${getSafeModDirectoryName(mod.id)}-${Date.now()}`);

        try {
            await mkdir(tempDir, { recursive: true });
            await git.clone({ fs, http, dir: tempDir, url: mod.sourceUrl, ref: mod.defaultBranch, singleBranch: true, depth: 1 });
            const modInfo = await readValidatedModInfo(tempDir, this.t);

            if (modInfo.id !== mod.id) {
                throw new Error(this.t("mods.error.restored.id.mismatch", { actual: modInfo.id, expected: mod.id }));
            }

            const commit = await git.resolveRef({ fs, dir: tempDir, ref: "HEAD" });
            await mkdir(dirname(modDir), { recursive: true });
            await fs.promises.rename(tempDir, modDir);
            const now = new Date().toISOString();

            return {
                ...mod,
                displayName: modInfo.name,
                installedCommit: commit,
                lastKnownRemoteCommit: commit,
                hasLocalChanges: false,
                updateAvailable: false,
                checkedAt: now,
                updatedAt: now
            };
        } catch (error) {
            await rm(tempDir, { recursive: true, force: true });
            console.error("[mods] failed to restore missing mod", mod.id, error);
            return { ...mod, hasLocalChanges: false, updateAvailable: false };
        }
    }

    private async hasLocalChanges(modDir: string): Promise<boolean> {
        const matrix = await git.statusMatrix({ fs, dir: modDir });
        return matrix.some((row) => row[1] !== row[2] || row[1] !== row[3]);
    }

    private async buildState(): Promise<ModRepositoryState> {
        const context = await this.getReadyContext();

        if (context.status !== "ready") {
            return { status: context.kind, mods: [], checking: this.checking, message: context.message };
        }

        try {
            await this.prepareChannelDirectories(context.repositoryPath, context.channelId);
            const registry = await this.readRegistry(context.repositoryPath, context.channelId);
            const items = await Promise.all(Object.values(registry.mods).map((mod) => this.buildItem(context.repositoryPath, context.channelId, mod)));

            return {
                status: "ready",
                repositoryPath: context.repositoryPath,
                channelId: context.channelId,
                modRepositoryPath: getChannelModRepositoryPath(context.repositoryPath, context.channelId),
                mods: items.sort((left, right) => left.displayName.localeCompare(right.displayName)),
                checking: this.checking
            };
        } catch (error) {
            return { status: "error", mods: [], checking: this.checking, message: getErrorMessage(error) };
        }
    }

    private async buildItem(repositoryPath: string, channelId: string, mod: ModInfo): Promise<ModInstanceInfo> {
        const modDir = this.getModDir(repositoryPath, channelId, mod);

        if (!(await exists(modDir))) {
            return this.toItem(repositoryPath, channelId, mod, "missing-local-copy");
        }

        try {
            const modInfo = await readValidatedModInfo(modDir, this.t);

            if (modInfo.id !== mod.id) {
                return this.toItem(repositoryPath, channelId, mod, "invalid-local-copy", this.t("mods.error.local.copy.id.mismatch", { actual: modInfo.id, expected: mod.id }));
            }
        } catch (error) {
            return this.toItem(repositoryPath, channelId, mod, "invalid-local-copy", getErrorMessage(error));
        }

        if (mod.hasLocalChanges && mod.updateAvailable) {
            return this.toItem(repositoryPath, channelId, mod, "blocked-by-local-changes");
        }

        if (mod.updateAvailable) {
            return this.toItem(repositoryPath, channelId, mod, "update-available");
        }

        return this.toItem(repositoryPath, channelId, mod, "installed");
    }

    private toItem(repositoryPath: string, channelId: string, mod: ModInfo, status: ModInstanceInfo["status"], error?: string): ModInstanceInfo {
        return {
            ...mod,
            status,
            absolutePath: this.getModDir(repositoryPath, channelId, mod),
            error
        };
    }

    private async prepareChannelDirectories(repositoryPath: string, channelId: string): Promise<void> {
        await mkdir(getChannelModsPath(repositoryPath, channelId), { recursive: true });
        await mkdir(getChannelModTempPath(repositoryPath, channelId), { recursive: true });
    }

    private async cleanupTemp(repositoryPath: string, channelId: string): Promise<void> {
        await rm(getChannelModTempPath(repositoryPath, channelId), { recursive: true, force: true });
        await mkdir(getChannelModTempPath(repositoryPath, channelId), { recursive: true });
    }

    private async readRegistry(repositoryPath: string, channelId: string): Promise<ModRegistry> {
        const registryPath = this.getRegistryPath(repositoryPath, channelId);

        try {
            const parsed: unknown = JSON.parse(await readFile(registryPath, "utf8"));
            return normalizeRegistry(parsed);
        } catch (error) {
            if (isNodeError(error) && error.code === "ENOENT") {
                const empty = createEmptyRegistry();
                await this.writeRegistry(repositoryPath, channelId, empty);
                return empty;
            }

            throw new Error(this.t("mods.error.registry.invalid"));
        }
    }

    private async writeRegistry(repositoryPath: string, channelId: string, registry: ModRegistry): Promise<void> {
        const registryPath = this.getRegistryPath(repositoryPath, channelId);
        await mkdir(dirname(registryPath), { recursive: true });
        await writeFile(registryPath, `${JSON.stringify(registry, null, 4)}\n`, "utf8");
    }

    private getRegistryPath(repositoryPath: string, channelId: string): string {
        return join(getChannelModRepositoryPath(repositoryPath, channelId), "mods.json");
    }

    private getModDir(repositoryPath: string, channelId: string, mod: ModInfo): string {
        return join(getChannelModRepositoryPath(repositoryPath, channelId), mod.relativePath);
    }

    private async getReadyContext(): Promise<{ status: "ready"; repositoryPath: string; channelId: string } | { status: "unavailable"; kind: "unconfigured" | "error"; message: string }> {
        const ws = workspaceService.getWorkspaceStatus();
        if (ws.status !== "ready") return { status: "unavailable", kind: ws.status === "unconfigured" ? "unconfigured" : "error", message: getRepositoryUnavailableMessage(ws) };
        return { status: "ready", repositoryPath: ws.path, channelId: ws.selectedGameChannel.id };
    }
}

function createEmptyRegistry(): ModRegistry {
    return { schemaVersion: 1, mods: {} };
}

function normalizeRegistry(value: unknown): ModRegistry {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return createEmptyRegistry();
    }

    const candidate = value as Partial<ModRegistry>;
    const mods: Record<string, ModInfo> = {};

    if (typeof candidate.mods === "object" && candidate.mods !== null && !Array.isArray(candidate.mods)) {
        for (const value of Object.values(candidate.mods)) {
            const mod = normalizeInstalledMod(value);

            if (mod !== null) {
                mods[mod.id] = mod;
            }
        }
    }

    return { schemaVersion: 1, mods };
}

function normalizeInstalledMod(value: unknown): ModInfo | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return null;
    }

    const candidate = value as Partial<ModInfo>;

    if (typeof candidate.id !== "string" || candidate.id.length === 0 || typeof candidate.sourceUrl !== "string" || typeof candidate.relativePath !== "string") {
        return null;
    }

    const now = new Date().toISOString();
    const defaultBranch = typeof candidate.defaultBranch === "string" && candidate.defaultBranch.length > 0 ? candidate.defaultBranch : "master";

    return {
        schemaVersion: 1,
        id: candidate.id,
        displayName: normalizeModDisplayName(candidate.displayName, candidate.id),
        sourceUrl: candidate.sourceUrl,
        defaultBranch,
        trackingRef: typeof candidate.trackingRef === "string" && candidate.trackingRef.length > 0 ? candidate.trackingRef : `refs/remotes/origin/${defaultBranch}`,
        installedCommit: typeof candidate.installedCommit === "string" ? candidate.installedCommit : "",
        lastKnownRemoteCommit: typeof candidate.lastKnownRemoteCommit === "string" ? candidate.lastKnownRemoteCommit : typeof candidate.installedCommit === "string" ? candidate.installedCommit : "",
        hasLocalChanges: candidate.hasLocalChanges === true,
        updateAvailable: candidate.updateAvailable === true,
        relativePath: candidate.relativePath,
        installedAt: typeof candidate.installedAt === "string" ? candidate.installedAt : now,
        checkedAt: typeof candidate.checkedAt === "string" ? candidate.checkedAt : undefined,
        updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : now,
        enabled: candidate.enabled !== false
    };
}

function getSafeModDirectoryName(modId: string): string {
    return modId.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function getRepositoryUnavailableMessage(repository: WorkspaceStatus): string {
    if (repository.status === "invalid") {
        return repository.message;
    }

    return translate("mods.error.repository.unavailable");
}

async function exists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") {
            return false;
        }

        throw error;
    }
}

export const modRepositoryService = new ModRepositoryService();
