import { ChildProcess, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";

import extractZip from "extract-zip";

import {
    type CreateGameBackupResult,
    type DeleteGameBackupResult,
    type GameBackupProgress,
    type GameBackupSummaryUpdate,
    type RenameGameBackupResult,
    type RestoreGameBackupResult,
    toAutoBackupCooldownMs
} from "../../shared/backups";
import { type GameAssetVariant, getGameAssetVariantFallbackOrder } from "../../shared/gameAssetVariants";
import { DEFAULT_GAME_CHANNEL_ID, findGameChannel, type GameChannelDefinition, getEffectiveGameChannels } from "../../shared/gameChannels";
import {
    CreateManualBackupOptions,
    DeleteGameInstallOptions,
    DeleteGameInstallResult,
    DOWNLOADS_DIRECTORY_NAME,
    GameInstall,
    GameInstallManifest,
    GameInstallProgress,
    GameInstallState,
    GameRelease,
    GameRuntimeState,
    GameSaveActivityUpdate,
    GameSaveSummary,
    GameSaveSummaryUpdate,
    GameWorldInfo,
    INSTALL_MANIFEST_FILE_NAME,
    InstallGameOptions,
    InstallGameResult,
    INSTALLS_DIRECTORY_NAME,
    KEEP_DOWNLOADED_DISTRIBUTIVES,
    LaunchGameOptions,
    LaunchGameResult,
    SetActiveGameInstallResult,
    StopGameResult,
    USERDATA_DIRECTORY_NAME
} from "../../shared/gameInstallations";
import { RepositoryConfig } from "../../shared/repository";
import { GitHubNetworkManager } from "../network/GitHubNetworkManager";
import { LocalRepositoryService } from "../repository/LocalRepositoryService";
import type { LauncherSettingsStore } from "../settings/LauncherSettingsStore";
import { type GameBackupContext, GameBackupService } from "./GameBackupService";
import { GameSaveMonitor, type GameSaveSettledActivity } from "./GameSaveMonitor";

const WINDOWS_EXECUTABLE_CANDIDATES = ["cataclysm-tiles.exe", "cataclysm.exe", "cataclysm-launcher.exe"];
const POSIX_EXECUTABLE_CANDIDATES = ["cataclysm-tiles", "cataclysm"];
type GitHubReleaseDto = {
    id?: number;
    name?: string | null;
    tag_name?: string;
    published_at?: string;
    html_url?: string;
    body?: string | null;
    draft?: boolean;
    assets?: GitHubAssetDto[];
};
type GitHubAssetDto = {
    name?: string;
    size?: number;
    browser_download_url?: string;
};

export class GameInstallationService {
    private progress: GameInstallProgress = { status: "idle" };
    private runtime: GameRuntimeState = { status: "idle" };
    private gameProcess: ChildProcess | null = null;
    private readonly gitHubNetwork = new GitHubNetworkManager();
    private readonly backupService: GameBackupService;
    private runtimeListeners = new Set<(runtime: GameRuntimeState) => void>();
    private progressListeners = new Set<(progress: GameInstallProgress) => void>();
    private saveSummaryListeners = new Set<(update: GameSaveSummaryUpdate) => void>();
    private saveActivityListeners = new Set<(update: GameSaveActivityUpdate) => void>();
    private activeSaveMonitor: GameSaveMonitor | null = null;
    private activeSaveMonitorInstallId: string | null = null;
    private activeSaveStable = true;
    private readonly preferredWorldByInstallId = new Map<string, string | null>();
    private readonly latestBackupAtByWorld = new Map<string, number>();

    constructor(
        private readonly repositoryService: LocalRepositoryService,
        private readonly settingsStore: LauncherSettingsStore
    ) {
        this.backupService = new GameBackupService(settingsStore);
    }

    onProgress(listener: (progress: GameInstallProgress) => void): () => void {
        this.progressListeners.add(listener);
        listener(this.progress);
        return () => this.progressListeners.delete(listener);
    }

    onRuntimeChanged(listener: (runtime: GameRuntimeState) => void): () => void {
        this.runtimeListeners.add(listener);
        listener(this.runtime);
        return () => this.runtimeListeners.delete(listener);
    }

    onSaveSummaryChanged(listener: (update: GameSaveSummaryUpdate) => void): () => void {
        this.saveSummaryListeners.add(listener);
        return () => this.saveSummaryListeners.delete(listener);
    }

    onSaveActivityChanged(listener: (update: GameSaveActivityUpdate) => void): () => void {
        this.saveActivityListeners.add(listener);
        return () => this.saveActivityListeners.delete(listener);
    }

    onBackupProgress(listener: (progress: GameBackupProgress) => void): () => void {
        return this.backupService.onProgress(listener);
    }

    onBackupSummaryChanged(listener: (update: GameBackupSummaryUpdate) => void): () => void {
        return this.backupService.onSummaryChanged(listener);
    }

    async getState(refreshLatest = false, forceRefresh = false): Promise<GameInstallState> {
        const repository = await this.repositoryService.getInitialStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: "Repository is not ready." };
        const channel = getSelectedChannel(repository.config);
        const { installs } = await this.readInstallsAndRepairConfig(repository.path, repository.config, channel.id);
        const activeInstall = installs.find((install) => install.isActive) ?? null;
        let latestRelease: GameRelease | null = null;
        let latestReleaseError: string | null = null;

        if (refreshLatest) {
            try {
                latestRelease = await this.findLatestRelease(channel, forceRefresh);
            } catch (error) {
                latestReleaseError = error instanceof Error ? error.message : String(error);
                console.error("[game-install] failed to check latest release", { channelId: channel.id, error });
            }
        }

        await this.updateActiveSaveMonitor(activeInstall);

        return {
            status: "ready",
            repositoryPath: repository.path,
            channel,
            activeInstall,
            installs,
            latestRelease,
            latestReleaseError,
            updateAvailable: latestRelease !== null && activeInstall !== null && latestRelease.id !== activeInstall.id,
            saves: activeInstall === null ? null : await readSaveSummary(activeInstall.userdataPath, this.preferredWorldByInstallId.get(activeInstall.id) ?? null),
            backups: await this.backupService.getSummary(activeInstall),
            runtime: this.runtime,
            savesStable: activeInstall === null || activeInstall.id !== this.activeSaveMonitorInstallId ? true : this.activeSaveStable
        };
    }

    async getReleases(forceRefresh = false): Promise<GameRelease[]> {
        const repository = await this.repositoryService.getInitialStatus();
        return repository.status === "ready" ? this.fetchReleases(getSelectedChannel(repository.config), forceRefresh) : [];
    }

    async setActiveInstall(installId: string): Promise<SetActiveGameInstallResult> {
        const repository = await this.repositoryService.getInitialStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: "Repository is not ready." };
        const channel = getSelectedChannel(repository.config);
        const installs = await this.readInstalls(repository.path, repository.config, channel.id);
        if (!installs.some((install) => install.id === installId)) return { status: "error", message: "Selected install does not exist." };
        await this.repositoryService.saveConfig(repository.path, {
            ...repository.config,
            activeInstallByChannel: {
                ...repository.config.activeInstallByChannel,
                [channel.id]: installId
            }
        });
        return { status: "updated", state: await this.getState(false) };
    }

    async deleteInstall(installId: string, options: DeleteGameInstallOptions): Promise<DeleteGameInstallResult> {
        const repository = await this.repositoryService.getInitialStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: "Repository is not ready." };
        const channel = getSelectedChannel(repository.config);
        const installs = await this.readInstalls(repository.path, repository.config, channel.id);
        const install = installs.find((candidate) => candidate.id === installId);
        if (install === undefined) return { status: "error", message: "Selected install does not exist." };
        if (install.isActive)
            return {
                status: "blocked",
                message: "Active install cannot be deleted. Select another version first."
            };
        await rm(install.path, { recursive: true, force: true });
        if (options.deleteUserdata) await rm(install.userdataPath, { recursive: true, force: true });
        return { status: "deleted", state: await this.getState(false) };
    }

    async installLatest(options: InstallGameOptions): Promise<InstallGameResult> {
        this.setProgress({ status: "resolving-release" });
        const repository = await this.repositoryService.getInitialStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: "Repository is not ready." };
        try {
            const channel = getSelectedChannel(repository.config);
            const releases = await this.fetchReleases(channel, false);
            const release = options.releaseId === undefined ? releases[0] : releases.find((candidate) => candidate.id === options.releaseId);
            if (release === undefined) {
                this.setProgress({ status: "idle" });
                return {
                    status: "error",
                    message: "No compatible release asset was found for the selected source."
                };
            }
            const installsBefore = await this.readInstalls(repository.path, repository.config, channel.id);
            const existingInstall = installsBefore.find((install) => install.id === release.id);
            if (existingInstall !== undefined) {
                if (options.makeActive) await this.setActiveInstall(existingInstall.id);
                this.setProgress({ status: "completed", releaseName: release.name });
                queueMicrotask(() => this.setProgress({ status: "idle" }));
                return {
                    status: "installed",
                    state: await this.getState(false),
                    install: existingInstall
                };
            }
            const install = await this.installRelease(repository.path, repository.config, channel, release, options, installsBefore);
            let config = repository.config;
            if (options.makeActive) {
                config = {
                    ...config,
                    activeInstallByChannel: {
                        ...config.activeInstallByChannel,
                        [channel.id]: install.id
                    }
                };
                await this.repositoryService.saveConfig(repository.path, config);
            }
            if (options.removeOlderInstalls) await this.removeOlderInstalls(repository.path, config, channel.id, install.id, true);
            await this.cleanupDownloads(repository.path, channel.id);
            this.setProgress({ status: "completed", releaseName: release.name });
            queueMicrotask(() => this.setProgress({ status: "idle" }));
            return { status: "installed", state: await this.getState(false), install };
        } catch (error) {
            console.error("[game-install] failed to install release", error);
            const message = error instanceof Error ? error.message : String(error);
            this.setProgress({ status: "error", message });
            return { status: "error", message };
        }
    }

    async launchActiveInstall(options: LaunchGameOptions = {}): Promise<LaunchGameResult> {
        return this.launchActiveInstallAsync(options);
    }

    stopGame(): StopGameResult {
        if (this.gameProcess === null || this.runtime.status !== "running") return { status: "not-running", runtime: this.runtime };
        try {
            this.gameProcess.kill();
            const runtime = this.setRuntime({ status: "idle" });
            this.gameProcess = null;
            return { status: "stopped", runtime };
        } catch (error) {
            return { status: "error", message: error instanceof Error ? error.message : String(error), runtime: this.runtime };
        }
    }

    getRuntimeState(): GameRuntimeState {
        return this.runtime;
    }

    async getInstallFolder(installId: string): Promise<string | null> {
        const state = await this.getState(false);
        if (state.status !== "ready") return null;
        return state.installs.find((install) => install.id === installId)?.path ?? null;
    }

    async getSavesFolder(installId: string): Promise<string | null> {
        const state = await this.getState(false);
        if (state.status !== "ready") return null;
        const path = state.installs.find((install) => install.id === installId)?.userdataPath ?? null;
        if (path !== null) await mkdir(path, { recursive: true });
        return path;
    }

    async createManualBackup(options: CreateManualBackupOptions = {}): Promise<CreateGameBackupResult> {
        const context = await this.getBackupContext(options.worldName);
        if (context === null) return { status: "unavailable", message: "Game is not installed." };
        const result = await this.backupService.createManualBackup(context);
        if (result.status === "created") this.touchAutoBackupCooldown(context.install.id, result.backup.worldFolderName);
        return result;
    }

    async restoreBackup(backupId: string): Promise<RestoreGameBackupResult> {
        const context = await this.getBackupContext();
        if (context === null) return { status: "unavailable", message: "Game is not installed." };
        return this.backupService.restoreBackup(context, backupId);
    }

    async deleteBackup(backupId: string): Promise<DeleteGameBackupResult> {
        const context = await this.getBackupContext();
        return this.backupService.deleteBackup(context?.install ?? null, backupId);
    }

    async renameBackup(backupId: string, comment: string): Promise<RenameGameBackupResult> {
        const context = await this.getBackupContext();
        return this.backupService.renameBackup(context?.install ?? null, backupId, comment);
    }

    private setProgress(progress: GameInstallProgress): void {
        this.progress = progress;
        for (const listener of this.progressListeners) listener(progress);
    }

    private setRuntime(runtime: GameRuntimeState): GameRuntimeState {
        this.runtime = runtime;
        for (const listener of this.runtimeListeners) listener(runtime);
        return runtime;
    }

    private emitSaveSummaryChanged(update: GameSaveSummaryUpdate): void {
        for (const listener of this.saveSummaryListeners) listener(update);
    }

    private emitSaveActivityChanged(update: GameSaveActivityUpdate): void {
        for (const listener of this.saveActivityListeners) listener(update);
    }

    private async updateActiveSaveMonitor(activeInstall: GameInstall | null): Promise<void> {
        if (activeInstall === null) {
            this.stopActiveSaveMonitor();
            this.activeSaveStable = true;
            await this.backupService.updateActiveInstall(null);
            return;
        }
        if (this.activeSaveMonitorInstallId === activeInstall.id) {
            await this.backupService.updateActiveInstall(activeInstall);
            return;
        }
        this.stopActiveSaveMonitor();
        const installId = activeInstall.id;
        this.activeSaveStable = true;
        const monitor = new GameSaveMonitor({
            userdataPath: activeInstall.userdataPath,
            onSettled: (activity) => this.processSettledSaveActivity(installId, activity),
            onStabilityChanged: (stable) => {
                this.activeSaveStable = stable;
                this.emitSaveActivityChanged({ installId, stable });
            }
        });
        this.activeSaveMonitor = monitor;
        this.activeSaveMonitorInstallId = installId;
        await monitor.start();
        await this.backupService.updateActiveInstall(activeInstall);
    }

    private stopActiveSaveMonitor(): void {
        this.activeSaveMonitor?.stop();
        this.activeSaveMonitor = null;
        this.activeSaveMonitorInstallId = null;
        this.clearAutoBackupState();
    }

    private clearAutoBackupState(): void {
        this.latestBackupAtByWorld.clear();
    }

    private async processSettledSaveActivity(installId: string, activity: GameSaveSettledActivity): Promise<void> {
        console.info(`[game-save] refresh save summary installId=${installId} events=${activity.eventCount} changedPaths=${activity.changedPaths.length}`);
        const changedWorldFolderNames = getChangedWorldFolderNames(activity);
        const state = await this.getState(false);
        if (state.status !== "ready" || state.activeInstall?.id !== installId || state.saves === null) return;
        const update: GameSaveSummaryUpdate = { installId, saves: state.saves };
        this.emitSaveSummaryChanged(update);
        this.queuePostSaveTasks(update, changedWorldFolderNames);
    }

    private queuePostSaveTasks(update: GameSaveSummaryUpdate, changedWorldFolderNames: string[]): void {
        this.queueAutoBackupAfterSave(update, changedWorldFolderNames);
    }

    private queueAutoBackupAfterSave(update: GameSaveSummaryUpdate, changedWorldFolderNames: string[]): void {
        if (this.runtime.status !== "running") return;
        for (const worldFolderName of changedWorldFolderNames) {
            void this.createAutoBackupAfterSave(update, worldFolderName);
        }
    }

    private async createAutoBackupAfterSave(update: GameSaveSummaryUpdate, worldFolderName: string): Promise<void> {
        const settings = await this.settingsStore.getUserSettings();
        if (isAutoBackupInCooldown(this.latestBackupAtByWorld.get(getAutoBackupTimerKey(update.installId, worldFolderName)) ?? null, toAutoBackupCooldownMs(settings.autoBackupCooldown))) return;
        const context = await this.getBackupContext(worldFolderName);
        if (context === null || context.install.id !== update.installId) return;
        const result = await this.backupService.createAutoBackup(context);
        if (result.status === "created") this.touchAutoBackupCooldown(context.install.id, result.backup.worldFolderName);
    }

    private touchAutoBackupCooldown(installId: string, worldFolderName: string): void {
        this.latestBackupAtByWorld.set(getAutoBackupTimerKey(installId, worldFolderName), Date.now());
    }

    private async getBackupContext(worldName?: string): Promise<GameBackupContext | null> {
        const state = await this.getState(false);
        if (state.status !== "ready" || state.activeInstall === null) return null;
        const preferredWorldName = worldName?.trim();
        const saves = preferredWorldName === undefined || preferredWorldName.length === 0 ? state.saves : await readSaveSummary(state.activeInstall.userdataPath, preferredWorldName);
        return {
            install: state.activeInstall,
            saves,
            gameRunning: this.runtime.status === "running",
            savesStable: state.activeInstall.id !== this.activeSaveMonitorInstallId ? true : this.activeSaveStable
        };
    }

    private async launchActiveInstallAsync(options: LaunchGameOptions): Promise<LaunchGameResult> {
        if (this.runtime.status === "running") return { status: "already-running", runtime: this.runtime };
        const state = await this.getState(false);
        if (state.status !== "ready") return { status: "unavailable", message: "Repository is not ready." };
        if (state.activeInstall === null) return { status: "unavailable", message: "Game is not installed." };

        const executablePath = await this.resolveExecutablePath(state.activeInstall);
        if (executablePath === null)
            return {
                status: "unavailable",
                message: "Game executable was not found. The install may have been removed or damaged."
            };

        await mkdir(state.activeInstall.userdataPath, { recursive: true });
        const args = ["--userdir", state.activeInstall.userdataPath];
        const worldName = options.worldName?.trim();
        if (worldName !== undefined && worldName.length > 0) args.push("--world", worldName);
        const child = spawn(executablePath, args, { cwd: dirname(executablePath), stdio: "ignore" });
        this.gameProcess = child;
        this.preferredWorldByInstallId.set(state.activeInstall.id, worldName ?? null);
        await this.updateActiveSaveMonitor(state.activeInstall);
        const runtime = this.setRuntime({ status: "running", pid: child.pid ?? 0, installId: state.activeInstall.id, worldName: worldName ?? null });
        child.once("exit", () => {
            if (this.gameProcess === child) {
                this.gameProcess = null;
                this.setRuntime({ status: "idle" });
            }
        });
        child.once("error", () => {
            if (this.gameProcess === child) {
                this.gameProcess = null;
                this.setRuntime({ status: "idle" });
            }
        });
        return { status: "launched", runtime };
    }

    private async resolveExecutablePath(install: GameInstall): Promise<string | null> {
        const manifestExecutablePath = install.manifest.executablePath;
        if (manifestExecutablePath !== null && (await pathExists(manifestExecutablePath))) return manifestExecutablePath;
        return findExecutable(install.path);
    }

    private async installRelease(repositoryPath: string, config: RepositoryConfig, channel: GameChannelDefinition, release: GameRelease, options: InstallGameOptions, installsBefore: GameInstall[]): Promise<GameInstall> {
        const installPath = join(repositoryPath, INSTALLS_DIRECTORY_NAME, channel.id, safePathSegment(release.id));
        const userdataPath = join(repositoryPath, USERDATA_DIRECTORY_NAME, channel.id, safePathSegment(release.id));
        const tempPath = `${installPath}.tmp-${Date.now()}`;
        const downloadPath = join(repositoryPath, DOWNLOADS_DIRECTORY_NAME, channel.id, basename(release.asset.name));
        await mkdir(dirname(installPath), { recursive: true });
        await mkdir(dirname(userdataPath), { recursive: true });
        await rm(tempPath, { recursive: true, force: true });
        await rm(installPath, { recursive: true, force: true });
        await this.downloadFile(release.asset.downloadUrl, downloadPath, release.name);
        await this.extractArchive(downloadPath, tempPath, release.name);
        const executablePath = await findExecutable(tempPath);
        const sourceUserdata = options.copyUserdata ? findUserdataSource(installsBefore, config.activeInstallByChannel[channel.id]) : null;
        this.setProgress({ status: "preparing-saves", releaseName: release.name });
        await mkdir(userdataPath, { recursive: true });
        if (sourceUserdata !== null && (await pathExists(sourceUserdata.userdataPath))) await copyDirectoryContents(sourceUserdata.userdataPath, userdataPath);
        const manifest: GameInstallManifest = {
            schemaVersion: 1,
            channelId: channel.id,
            releaseId: release.id,
            releaseName: release.name,
            tagName: release.tagName,
            publishedAt: release.publishedAt,
            htmlUrl: release.htmlUrl,
            releaseBody: release.body,
            assetName: release.asset.name,
            installedAt: new Date().toISOString(),
            executablePath: executablePath === null ? null : join(installPath, relative(tempPath, executablePath)),
            userdataPath,
            copiedUserdataFromInstallId: sourceUserdata?.id ?? null,
            source: {
                owner: channel.githubOwner,
                repo: channel.githubRepo,
                branch: channel.githubBranch
            }
        };
        this.setProgress({ status: "finalizing", releaseName: release.name });
        await writeFile(join(tempPath, INSTALL_MANIFEST_FILE_NAME), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
        await rename(tempPath, installPath);
        return {
            id: release.id,
            path: installPath,
            userdataPath,
            manifest,
            isActive: false
        };
    }

    private async readInstallsAndRepairConfig(repositoryPath: string, config: RepositoryConfig, channelId: string): Promise<{ config: RepositoryConfig; installs: GameInstall[] }> {
        const installs = await this.readInstalls(repositoryPath, config, channelId);
        const activeInstallId = config.activeInstallByChannel[channelId] ?? null;
        const activeInstallExists = activeInstallId !== null && installs.some((install) => install.id === activeInstallId);

        if (activeInstallId === null || activeInstallExists) return { config, installs };

        const activeInstallByChannel = { ...config.activeInstallByChannel };
        delete activeInstallByChannel[channelId];
        const repairedConfig = { ...config, activeInstallByChannel };
        await this.repositoryService.saveConfig(repositoryPath, repairedConfig);
        return {
            config: repairedConfig,
            installs: installs.map((install) => ({ ...install, isActive: false }))
        };
    }

    private async readInstalls(repositoryPath: string, config: RepositoryConfig, channelId: string): Promise<GameInstall[]> {
        const channelInstallsPath = join(repositoryPath, INSTALLS_DIRECTORY_NAME, channelId);
        const activeInstallId = config.activeInstallByChannel[channelId] ?? null;
        let entries: string[];
        try {
            entries = await readdir(channelInstallsPath);
        } catch (error) {
            if (isNodeError(error) && error.code === "ENOENT") return [];
            throw error;
        }
        const installs: GameInstall[] = [];
        for (const entry of entries) {
            const installPath = join(channelInstallsPath, entry);
            try {
                if (!(await stat(installPath)).isDirectory()) continue;
                const manifest = JSON.parse(await readFile(join(installPath, INSTALL_MANIFEST_FILE_NAME), "utf8")) as unknown;
                if (!isGameInstallManifest(manifest) || manifest.channelId !== channelId) continue;
                const userdataPath = resolveUserdataPath(repositoryPath, channelId, manifest);
                const normalizedManifest = manifest.userdataPath === userdataPath ? manifest : { ...manifest, userdataPath };
                installs.push({
                    id: normalizedManifest.releaseId,
                    path: installPath,
                    userdataPath,
                    manifest: normalizedManifest,
                    isActive: normalizedManifest.releaseId === activeInstallId
                });
            } catch (error) {
                console.error(`[game-install] failed to read install: ${installPath}`, error);
            }
        }
        return installs.sort((a, b) => b.manifest.publishedAt.localeCompare(a.manifest.publishedAt));
    }

    private async findLatestRelease(channel: GameChannelDefinition, forceRefresh: boolean): Promise<GameRelease | null> {
        return (await this.fetchReleases(channel, forceRefresh))[0] ?? null;
    }

    private async fetchReleases(channel: GameChannelDefinition, forceRefresh: boolean): Promise<GameRelease[]> {
        const gameAssetVariant = await this.settingsStore.getGameAssetVariant();
        return this.gitHubNetwork.getCached(getReleaseCacheKey(channel, gameAssetVariant), () => this.fetchReleasesFromGitHub(channel, forceRefresh, gameAssetVariant), { forceRefresh });
    }

    private async fetchReleasesFromGitHub(channel: GameChannelDefinition, forceRefresh: boolean, gameAssetVariant: GameAssetVariant): Promise<GameRelease[]> {
        const pageCount = channel.kind === "stable" ? 5 : 1;
        const releases: GameRelease[] = [];
        for (let page = 1; page <= pageCount; page += 1) {
            const value = await this.fetchReleasePage(channel, page, forceRefresh);
            if (!Array.isArray(value) || value.length === 0) break;
            releases.push(
                ...value
                    .map((item) => toGameRelease(item, channel, gameAssetVariant))
                    .filter((item): item is GameRelease => item !== null)
                    .filter((item) => matchesChannelKind(item, channel))
            );
            if (channel.kind === "stable" && releases.length > 0) break;
        }
        return releases.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    }

    private async fetchReleasePage(channel: GameChannelDefinition, page: number, forceRefresh: boolean): Promise<unknown> {
        const url = withGitHubPageSize(channel.releasesUrl, page);
        return this.gitHubNetwork.getJson<unknown>(url, { forceRefresh });
    }

    private async downloadFile(url: string, targetPath: string, releaseName: string): Promise<void> {
        const temporaryPath = `${targetPath}.tmp-${Date.now()}`;
        const response = isGitHubUrl(url) ? await this.gitHubNetwork.fetch(url) : await fetch(url);
        if (!response.ok || response.body === null) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        const totalBytes = Number(response.headers.get("content-length"));
        const knownTotalBytes = Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : null;
        let transferredBytes = 0;
        this.setProgress({
            status: "downloading",
            releaseName,
            percent: null,
            transferredBytes,
            totalBytes: knownTotalBytes
        });
        await mkdir(dirname(targetPath), { recursive: true });
        const fileStream = createWriteStream(temporaryPath);
        const source = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
        source.on("data", (chunk: Buffer | Uint8Array) => {
            transferredBytes += chunk.byteLength;
            const percent = knownTotalBytes === null ? null : Math.max(0, Math.min(100, Math.round((transferredBytes / knownTotalBytes) * 100)));
            this.setProgress({
                status: "downloading",
                releaseName,
                percent,
                transferredBytes,
                totalBytes: knownTotalBytes
            });
        });
        await finished(source.pipe(fileStream));
        await rename(temporaryPath, targetPath);
    }

    private async extractArchive(archivePath: string, targetPath: string, releaseName: string): Promise<void> {
        await mkdir(targetPath, { recursive: true });
        let percent = 0;
        this.setProgress({ status: "extracting", releaseName, percent });
        const timer = setInterval(() => {
            percent = Math.min(96, percent + Math.max(1, Math.round((96 - percent) * 0.16)));
            this.setProgress({ status: "extracting", releaseName, percent });
        }, 450);
        try {
            if (archivePath.toLowerCase().endsWith(".zip")) {
                await extractZip(archivePath, { dir: targetPath });
            } else {
                await runCommand("tar", ["-xf", archivePath, "-C", targetPath]);
            }
            this.setProgress({ status: "extracting", releaseName, percent: 100 });
        } finally {
            clearInterval(timer);
        }
    }

    private async cleanupDownloads(repositoryPath: string, channelId: string): Promise<void> {
        const downloadsPath = join(repositoryPath, DOWNLOADS_DIRECTORY_NAME, channelId);
        let entries: string[];
        try {
            entries = await readdir(downloadsPath);
        } catch (error) {
            if (isNodeError(error) && error.code === "ENOENT") return;
            throw error;
        }
        const files = (
            await Promise.all(
                entries.map(async (entry) => {
                    const path = join(downloadsPath, entry);
                    const itemStat = await stat(path);
                    return { path, mtime: itemStat.mtimeMs, isFile: itemStat.isFile() };
                })
            )
        )
            .filter((file) => file.isFile)
            .sort((a, b) => b.mtime - a.mtime)
            .slice(KEEP_DOWNLOADED_DISTRIBUTIVES);
        await Promise.all(files.map((file) => rm(file.path, { force: true })));
    }

    private async removeOlderInstalls(repositoryPath: string, config: RepositoryConfig, channelId: string, keepInstallId: string, deleteUserdata: boolean): Promise<void> {
        const installs = await this.readInstalls(repositoryPath, config, channelId);
        await Promise.all(
            installs
                .filter((install) => install.id !== keepInstallId)
                .map(async (install) => {
                    await rm(install.path, { recursive: true, force: true });
                    if (deleteUserdata) await rm(install.userdataPath, { recursive: true, force: true });
                })
        );
    }
}

function resolveUserdataPath(repositoryPath: string, channelId: string, manifest: GameInstallManifest): string {
    if (manifest.userdataPath.length > 0) return manifest.userdataPath;
    return join(repositoryPath, USERDATA_DIRECTORY_NAME, channelId, safePathSegment(manifest.releaseId));
}

function getSelectedChannel(config: RepositoryConfig): GameChannelDefinition {
    return findGameChannel(getEffectiveGameChannels(config.customChannels), config.selectedChannelId || DEFAULT_GAME_CHANNEL_ID);
}

function getReleaseCacheKey(channel: GameChannelDefinition, gameAssetVariant: GameAssetVariant): string {
    const platformKey = process.platform === "win32" ? "windows" : "linux";
    return `${channel.id}:${platformKey}:${gameAssetVariant}:${channel.releasesUrl}`;
}

function isGitHubUrl(url: string): boolean {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host === "github.com" || host.endsWith(".github.com") || host === "githubusercontent.com" || host.endsWith(".githubusercontent.com");
    } catch {
        return false;
    }
}

function withGitHubPageSize(url: string, page: number): string {
    try {
        const value = new URL(url);
        if (value.hostname === "api.github.com") {
            if (!value.searchParams.has("per_page")) value.searchParams.set("per_page", "50");
            value.searchParams.set("page", page.toString());
        }
        return value.toString();
    } catch {
        return url;
    }
}
function matchesChannelKind(release: GameRelease, channel: GameChannelDefinition): boolean {
    const value = `${release.id} ${release.name}`.toLowerCase();
    const isExperimentalRelease = value.includes("experimental");
    return channel.kind === "experimental" ? isExperimentalRelease : !isExperimentalRelease;
}
function toAssetNameParts(value: string | string[]): string[] {
    return Array.isArray(value) ? value : [value];
}

function toGameRelease(value: unknown, channel: GameChannelDefinition, gameAssetVariant: GameAssetVariant): GameRelease | null {
    if (typeof value !== "object" || value === null) return null;
    const release = value as GitHubReleaseDto;
    if (release.draft === true || typeof release.tag_name !== "string" || typeof release.published_at !== "string") return null;
    const asset = selectReleaseAsset(release.assets, channel, gameAssetVariant);
    if (asset?.name === undefined || asset.browser_download_url === undefined) return null;
    return {
        id: release.tag_name,
        name: release.name ?? release.tag_name,
        tagName: release.tag_name,
        publishedAt: release.published_at,
        htmlUrl: release.html_url ?? `https://github.com/${channel.githubOwner}/${channel.githubRepo}/releases/tag/${encodeURIComponent(release.tag_name)}`,
        body: release.body ?? "",
        asset: {
            name: asset.name,
            size: typeof asset.size === "number" ? asset.size : 0,
            downloadUrl: asset.browser_download_url
        }
    };
}
function selectReleaseAsset(assets: GitHubAssetDto[] | undefined, channel: GameChannelDefinition, gameAssetVariant: GameAssetVariant): GitHubAssetDto | null {
    const compatibleAssets = assets?.filter((candidate) => isCompatibleAsset(candidate, channel)) ?? [];
    const fallbackOrder = getGameAssetVariantFallbackOrder(gameAssetVariant);

    for (const variant of fallbackOrder) {
        const asset = compatibleAssets.find((candidate) => getAssetVariant(candidate) === variant);
        if (asset !== undefined) return asset;
    }

    return compatibleAssets[0] ?? null;
}

function getAssetVariant(asset: GitHubAssetDto): GameAssetVariant {
    const assetName = asset.name?.toLowerCase() ?? "";

    if (assetName.includes("with-graphics-and-sounds") || assetName.includes("with-sounds")) return "graphics-and-sounds";
    if (assetName.includes("with-graphics")) return "graphics";
    return "tiles";
}

function isCompatibleAsset(asset: GitHubAssetDto, channel: GameChannelDefinition): boolean {
    if (typeof asset.name !== "string" || typeof asset.browser_download_url !== "string") return false;
    const platformKey = process.platform === "win32" ? "windows" : "linux";
    const requiredNameParts = toAssetNameParts(channel.assetNameIncludes[platformKey]);
    const assetName = asset.name.toLowerCase();
    const isSupportedArchive = assetName.endsWith(".zip") || assetName.endsWith(".tar.gz") || assetName.endsWith(".tgz");
    return isSupportedArchive && requiredNameParts.some((part) => part.length > 0 && assetName.includes(part.toLowerCase()));
}
function isGameInstallManifest(value: unknown): value is GameInstallManifest {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Partial<GameInstallManifest>;
    return (
        candidate.schemaVersion === 1 &&
        typeof candidate.channelId === "string" &&
        typeof candidate.releaseId === "string" &&
        typeof candidate.releaseName === "string" &&
        typeof candidate.tagName === "string" &&
        typeof candidate.publishedAt === "string" &&
        typeof candidate.htmlUrl === "string" &&
        typeof candidate.assetName === "string" &&
        typeof candidate.installedAt === "string" &&
        (candidate.executablePath === null || typeof candidate.executablePath === "string") &&
        typeof candidate.userdataPath === "string"
    );
}
function safePathSegment(value: string): string {
    return (
        value
            .split("")
            .map((char) => (/[<>:"/\\|?*]/.test(char) || char.charCodeAt(0) < 32 ? "_" : char))
            .join("")
            .trim() || "release"
    );
}
async function findExecutable(rootPath: string): Promise<string | null> {
    const candidates = process.platform === "win32" ? WINDOWS_EXECUTABLE_CANDIDATES : POSIX_EXECUTABLE_CANDIDATES;
    const queue = [rootPath];
    while (queue.length > 0) {
        const directory = queue.shift()!;
        const entries = await readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            const path = join(directory, entry.name);
            if (entry.isDirectory()) queue.push(path);
            else if (entry.isFile() && candidates.includes(entry.name)) return path;
        }
    }
    return null;
}
function findUserdataSource(installs: GameInstall[], activeInstallId: string | undefined): GameInstall | null {
    return (activeInstallId === undefined ? undefined : installs.find((install) => install.id === activeInstallId)) ?? installs[0] ?? null;
}
async function copyDirectoryContents(sourcePath: string, targetPath: string): Promise<void> {
    await mkdir(targetPath, { recursive: true });
    await Promise.all(
        (await readdir(sourcePath)).map((entry) =>
            cp(join(sourcePath, entry), join(targetPath, entry), {
                recursive: true,
                force: true
            })
        )
    );
}
async function pathExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}
async function runCommand(command: string, args: string[]): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const child = spawn(command, args, { stdio: "ignore" });
        child.on("error", reject);
        child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code ?? "unknown"}.`))));
    });
}
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error;
}

function getAutoBackupTimerKey(installId: string, worldFolderName: string): string {
    return `${installId}:${worldFolderName}`;
}

function isAutoBackupInCooldown(latestBackupAt: number | null, cooldownMs: number): boolean {
    return cooldownMs > 0 && latestBackupAt !== null && Date.now() - latestBackupAt < cooldownMs;
}

function getChangedWorldFolderNames(activity: GameSaveSettledActivity): string[] {
    const folders = new Set<string>();
    for (const changedPath of activity.keyChangedPaths) {
        const normalized = changedPath.split("\\").join("/");
        const match = /(?:^|\/)save\/([^/]+)\/[^/]+$/.exec(normalized);
        if (match !== null) folders.add(match[1]);
    }
    return [...folders];
}

async function readSaveSummary(userdataPath: string, preferredWorldName: string | null = null): Promise<GameSaveSummary> {
    const savePath = join(userdataPath, "save");
    let entries: string[];
    try {
        entries = await readdir(savePath);
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return { worlds: [], currentWorld: null };
        throw error;
    }

    const worlds = (
        await Promise.all(
            entries.map(async (entry): Promise<GameWorldInfo | null> => {
                const worldPath = join(savePath, entry);
                try {
                    if (!(await stat(worldPath)).isDirectory()) return null;
                    const character = await readFirstCharacter(worldPath);
                    return {
                        name: decodeWorldFolderName(entry),
                        folderName: entry,
                        characterName: character?.name ?? null
                    };
                } catch (error) {
                    if (isNodeError(error) && error.code === "ENOENT") return null;
                    console.error(`[game-install] failed to read world: ${worldPath}`, error);
                    return null;
                }
            })
        )
    )
        .filter((world): world is GameWorldInfo => world !== null)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    const preferredWorld = preferredWorldName === null ? null : (worlds.find((world) => world.name === preferredWorldName || world.folderName === preferredWorldName) ?? null);
    return { worlds, currentWorld: preferredWorld ?? (worlds.length === 1 ? worlds[0] : null) };
}

type CharacterSaveInfo = {
    name: string;
};

async function readFirstCharacter(worldPath: string): Promise<CharacterSaveInfo | null> {
    let entries: Array<{ isFile(): boolean; name: string }>;
    try {
        entries = await readdir(worldPath, { withFileTypes: true });
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return null;
        throw error;
    }

    const saves = await Promise.all(
        entries
            .filter((entry) => entry.isFile() && /^#.+\.sav\.zzip$/i.test(entry.name))
            .map(async (entry) => {
                return {
                    characterName: decodeCharacterName(entry.name)
                };
            })
    );
    const firstSave = saves.sort((a, b) => a.characterName.localeCompare(b.characterName, undefined, { sensitivity: "base" }))[0];
    if (firstSave === undefined) return null;
    return {
        name: firstSave.characterName
    };
}

function decodeWorldFolderName(folderName: string): string {
    const unicodeDecoded = decodeUnicodeEscapedPathSegment(folderName);
    return unicodeDecoded ?? folderName;
}

function decodeUnicodeEscapedPathSegment(value: string): string | null {
    if (!/^#U[0-9a-fA-F]{4}/.test(value)) return null;
    const decoded = value.replace(/#U([0-9a-fA-F]{4})/g, (_match, code: string) => String.fromCharCode(parseInt(code, 16))).trim();
    return decoded.length > 0 ? decoded : null;
}

function decodeCharacterName(fileName: string): string {
    const encoded = fileName.replace(/^#/, "").replace(/\.sav\.zzip$/i, "");
    const decoded = decodeCddaSaveFileName(encoded);
    return decoded ?? encoded;
}

function decodeCddaSaveFileName(encoded: string): string | null {
    const candidates = [encoded.replace(/-/g, "/").replace(/_/g, "/"), encoded.replace(/-/g, "+").replace(/_/g, "/"), encoded];

    for (const candidate of candidates) {
        const decoded = decodeBase64Utf8(candidate);
        if (decoded !== null && !decoded.includes("�")) return decoded;
    }

    return null;
}

function decodeBase64Utf8(value: string): string | null {
    try {
        const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
        const decoded = Buffer.from(padded, "base64").toString("utf8").replace(/\0/g, "").trim();
        return decoded.length > 0 ? decoded : null;
    } catch {
        return null;
    }
}
