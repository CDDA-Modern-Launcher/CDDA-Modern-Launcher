import { type ChildProcess, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";

import extractZip from "extract-zip";

import { RepositoryConfig } from "../../shared/RepositoryConfig";
import type { LocalizationService } from "../localization/LocalizationService";
import { GitHubNetworkManager } from "../network/GitHubNetworkManager";
import { LocalRepositoryService } from "../repository/LocalRepositoryService";
import { type GameBackupContext, GameBackupService } from "./GameBackupService";
import { GameSaveMonitor, type GameSaveSettledActivity } from "./GameSaveMonitor";
import {
    copyDirectoryContents,
    findExecutable,
    findUserdataSource,
    getSelectedChannel,
    isGameInstallManifest,
    isGitHubUrl,
    isNodeError,
    pathExists,
    resolveUserdataPath,
    runCommand,
    safePathSegment
} from "./install/installUtils";
import { getReleaseCacheKey, matchesChannelKind, toGameRelease, withGitHubPageSize } from "./releases/releaseSelection";
import { getAutoBackupTimerKey, getChangedWorldFolderNames, isAutoBackupInCooldown, readSaveSummary } from "./saves/saveSummary";
import { BackupProgress } from "../../shared/backups/types/BackupProgress";
import { BackupSummaryUpdate } from "../../shared/backups/types/BackupSummaryUpdate";
import { EBackupCreateResult } from "../../shared/backups/types/EBackupCreateResult";
import { EBackupDeleteResult } from "../../shared/backups/types/EBackupDeleteResult";
import { toAutoBackupCooldownMs } from "../../shared/backups/toAutoBackupCooldownMs";
import { EBackupRestoreResult } from "../../shared/backups/types/EBackupRestoreResult";

import { EBackupRenameResult } from "../../shared/backups/types/EBackupRenameResult";
import { TReleaseAssetVariant } from "../../shared/release-asset/TReleaseAssetVariant";
import { GameChannelDefinition } from "../../shared/game-channel/GameChannelDefinition";
import { DOWNLOADS_DIRECTORY_NAME, INSTALL_MANIFEST_FILE_NAME, INSTALLS_DIRECTORY_NAME, KEEP_DOWNLOADED_DISTRIBUTIVES, USERDATA_DIRECTORY_NAME } from "../../shared/Const";
import { GithubRelease } from "../../shared/GithubRelease";
import { DistributiveInfo } from "../../shared/distributive/DistributiveInfo";
import { Distributive } from "../../shared/distributive/Distributive";
import { GameSaveSummaryUpdate } from "../../shared/GameSaveSummaryUpdate";
import { GameSaveActivityUpdate } from "../../shared/GameSaveActivityUpdate";
import { GameRuntimeState } from "../../shared/GameRuntimeState";
import { GameLaunchOptions } from "../../shared/launch/GameLaunchOptions";
import { CreateManualBackupOptions } from "../../shared/backups/types/CreateManualBackupOptions";
import { DistributiveState } from "../../shared/distributive/DistributiveState";
import { InstallDistributiveOptions } from "../../shared/distributive/InstallDistributiveOptions";
import { DistributiveDeleteOptions } from "../../shared/distributive/DistributiveDeleteOptions";
import { EInstallDistributiveResult } from "../../shared/distributive/EInstallDistributiveResult";
import { EDistributiveSetActiveResult } from "../../shared/distributive/EDistributiveSetActiveResult";
import { EDistributiveDeleteResult } from "../../shared/distributive/EDistributiveDeleteResult";
import { EGameLaunchResult } from "../../shared/launch/EGameLaunchResult";
import { EGameStopResult } from "../../shared/launch/EGameStopResult";
import { InstallDistributiveProgress } from "../../shared/distributive/InstallDistributiveProgress";

export class GameInstallationService {
    private progress: InstallDistributiveProgress = { status: "idle" };
    private runtimeState: GameRuntimeState = { status: "idle" };
    private gameProcess: ChildProcess | null = null;
    private readonly gitHubNetwork = new GitHubNetworkManager();
    private readonly backupService: GameBackupService;
    private runtimeListeners = new Set<(runtime: GameRuntimeState) => void>();
    private progressListeners = new Set<(progress: InstallDistributiveProgress) => void>();
    private saveSummaryListeners = new Set<(update: GameSaveSummaryUpdate) => void>();
    private saveActivityListeners = new Set<(update: GameSaveActivityUpdate) => void>();
    private activeSaveMonitor: GameSaveMonitor | null = null;
    private activeSaveMonitorInstallId: string | null = null;
    private activeSaveStable = true;
    private readonly preferredWorldByInstallId = new Map<string, string | null>();
    private readonly latestBackupAtByWorld = new Map<string, number>();

    constructor(
        private readonly repositoryService: LocalRepositoryService,
        private readonly localizationService: LocalizationService
    ) {
        this.backupService = new GameBackupService(repositoryService, localizationService);
    }

    private t(key: string): string {
        return this.localizationService.t(key);
    }

    onProgress(listener: (progress: InstallDistributiveProgress) => void): () => void {
        this.progressListeners.add(listener);
        listener(this.progress);
        return () => this.progressListeners.delete(listener);
    }

    onRuntimeChanged(listener: (runtime: GameRuntimeState) => void): () => void {
        this.runtimeListeners.add(listener);
        listener(this.runtimeState);
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

    onBackupProgress(listener: (progress: BackupProgress) => void): () => void {
        return this.backupService.onProgress(listener);
    }

    onBackupSummaryChanged(listener: (update: BackupSummaryUpdate) => void): () => void {
        return this.backupService.onSummaryChanged(listener);
    }

    async getState(refreshLatest = false, forceRefresh = false): Promise<DistributiveState> {
        const repository = await this.repositoryService.getInitialStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: this.t("game.error.repositoryNotReady") };
        const channel = getSelectedChannel(repository.config);
        const { installs } = await this.readInstallsAndRepairConfig(repository.path, repository.config, channel.id);
        const activeInstall = installs.find((install) => install.isActive) ?? null;
        let latestRelease: GithubRelease | null = null;
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
            distributive: activeInstall,
            distributives: installs,
            latestRelease,
            latestReleaseError,
            updateAvailable: latestRelease !== null && activeInstall !== null && latestRelease.id !== activeInstall.id,
            saves: activeInstall === null ? null : await readSaveSummary(activeInstall.userdataPath, this.preferredWorldByInstallId.get(activeInstall.id) ?? null),
            backups: await this.backupService.getSummary(activeInstall),
            runtimeState: this.runtimeState,
            savesStable: activeInstall === null || activeInstall.id !== this.activeSaveMonitorInstallId ? true : this.activeSaveStable
        };
    }

    async getReleases(forceRefresh = false): Promise<GithubRelease[]> {
        const repository = await this.repositoryService.getInitialStatus();
        return repository.status === "ready" ? this.fetchReleases(getSelectedChannel(repository.config), forceRefresh) : [];
    }

    async setActiveInstall(installId: string): Promise<EDistributiveSetActiveResult> {
        const repository = await this.repositoryService.getInitialStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: this.t("game.error.repositoryNotReady") };
        const channel = getSelectedChannel(repository.config);
        const installs = await this.readInstalls(repository.path, repository.config, channel.id);
        if (!installs.some((install) => install.id === installId)) return { status: "error", message: this.t("game.error.installMissing") };
        await this.repositoryService.saveConfig(repository.path, {
            ...repository.config,
            activeInstallByChannel: {
                ...repository.config.activeInstallByChannel,
                [channel.id]: installId
            }
        });
        try {
            return { status: "updated", state: await this.getStateWithLatestRelease(await this.findLatestRelease(channel, false)) };
        } catch (error) {
            console.error("[game-install] failed to check latest release after active install change", { channelId: channel.id, error });
            return { status: "updated", state: await this.getState(false) };
        }
    }

    async deleteInstall(installId: string, options: DistributiveDeleteOptions): Promise<EDistributiveDeleteResult> {
        const repository = await this.repositoryService.getInitialStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: this.t("game.error.repositoryNotReady") };
        const channel = getSelectedChannel(repository.config);
        const installs = await this.readInstalls(repository.path, repository.config, channel.id);
        const install = installs.find((candidate) => candidate.id === installId);
        if (install === undefined) return { status: "error", message: this.t("game.error.installMissing") };
        if (install.isActive)
            return {
                status: "blocked",
                message: this.t("game.error.activeInstallDeleteBlocked")
            };
        await rm(install.path, { recursive: true, force: true });
        if (options.deleteUserdata) await rm(install.userdataPath, { recursive: true, force: true });
        return { status: "deleted", state: await this.getState(false) };
    }

    async installLatest(options: InstallDistributiveOptions): Promise<EInstallDistributiveResult> {
        this.setProgress({ status: "resolving-release" });
        const repository = await this.repositoryService.getInitialStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: this.t("game.error.repositoryNotReady") };
        try {
            const channel = getSelectedChannel(repository.config);
            const releases = await this.fetchReleases(channel, false);
            const release = options.releaseId === undefined ? releases[0] : releases.find((candidate) => candidate.id === options.releaseId);
            if (release === undefined) {
                this.setProgress({ status: "idle" });
                return {
                    status: "error",
                    message: this.t("game.error.noCompatibleReleaseAsset")
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
                    state: await this.getStateWithLatestRelease(releases[0] ?? null),
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
            return { status: "installed", state: await this.getStateWithLatestRelease(releases[0] ?? null), install };
        } catch (error) {
            console.error("[game-install] failed to install release", error);
            const message = error instanceof Error ? error.message : String(error);
            this.setProgress({ status: "error", message });
            return { status: "error", message };
        }
    }

    async launchActiveInstall(options: GameLaunchOptions = {}): Promise<EGameLaunchResult> {
        return this.launchActiveInstallAsync(options);
    }

    stopGame(): EGameStopResult {
        if (this.gameProcess === null || this.runtimeState.status !== "running") return { status: "not-running", runtime: this.runtimeState };
        try {
            this.gameProcess.kill();
            const runtime = this.setRuntime({ status: "idle" });
            this.gameProcess = null;
            return { status: "stopped", runtime };
        } catch (error) {
            return { status: "error", message: error instanceof Error ? error.message : String(error), runtime: this.runtimeState };
        }
    }

    getRuntimeState(): GameRuntimeState {
        return this.runtimeState;
    }

    async getInstallFolder(installId: string): Promise<string | null> {
        const state = await this.getState(false);
        if (state.status !== "ready") return null;
        return state.distributives.find((install) => install.id === installId)?.path ?? null;
    }

    async getSavesFolder(installId: string): Promise<string | null> {
        const state = await this.getState(false);
        if (state.status !== "ready") return null;
        const path = state.distributives.find((install) => install.id === installId)?.userdataPath ?? null;
        if (path !== null) await mkdir(path, { recursive: true });
        return path;
    }

    async createManualBackup(options: CreateManualBackupOptions = {}): Promise<EBackupCreateResult> {
        const context = await this.getBackupContext(options.worldName);
        if (context === null) return { status: "unavailable", message: this.t("game.error.notInstalled") };
        const result = await this.backupService.createManualBackup(context);
        if (result.status === "created") this.touchAutoBackupCooldown(context.install.id, result.backup.worldFolderName);
        return result;
    }

    async restoreBackup(backupId: string): Promise<EBackupRestoreResult> {
        const context = await this.getBackupContext();
        if (context === null) return { status: "unavailable", message: this.t("game.error.notInstalled") };
        return this.backupService.restoreBackup(context, backupId);
    }

    async deleteBackup(backupId: string): Promise<EBackupDeleteResult> {
        const context = await this.getBackupContext();
        return this.backupService.deleteBackup(context?.install ?? null, backupId);
    }

    async renameBackup(backupId: string, comment: string): Promise<EBackupRenameResult> {
        const context = await this.getBackupContext();
        return this.backupService.renameBackup(context?.install ?? null, backupId, comment);
    }

    private setProgress(progress: InstallDistributiveProgress): void {
        this.progress = progress;
        for (const listener of this.progressListeners) listener(progress);
    }

    private setRuntime(runtime: GameRuntimeState): GameRuntimeState {
        this.runtimeState = runtime;
        for (const listener of this.runtimeListeners) listener(runtime);
        return runtime;
    }

    private emitSaveSummaryChanged(update: GameSaveSummaryUpdate): void {
        for (const listener of this.saveSummaryListeners) listener(update);
    }

    private emitSaveActivityChanged(update: GameSaveActivityUpdate): void {
        for (const listener of this.saveActivityListeners) listener(update);
    }

    private async updateActiveSaveMonitor(activeInstall: Distributive | null): Promise<void> {
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
                this.emitSaveActivityChanged({ distributiveId: installId, stable });
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
        if (state.status !== "ready" || state.distributive?.id !== installId || state.saves === null) return;
        const update: GameSaveSummaryUpdate = { installId, saves: state.saves };
        this.emitSaveSummaryChanged(update);
        this.queuePostSaveTasks(update, changedWorldFolderNames);
    }

    private queuePostSaveTasks(update: GameSaveSummaryUpdate, changedWorldFolderNames: string[]): void {
        this.queueAutoBackupAfterSave(update, changedWorldFolderNames);
    }

    private queueAutoBackupAfterSave(update: GameSaveSummaryUpdate, changedWorldFolderNames: string[]): void {
        if (this.runtimeState.status !== "running") return;
        for (const worldFolderName of changedWorldFolderNames) {
            void this.createAutoBackupAfterSave(update, worldFolderName);
        }
    }

    private async createAutoBackupAfterSave(update: GameSaveSummaryUpdate, worldFolderName: string): Promise<void> {
        const settings = await this.repositoryService.getUserSettings();
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
        if (state.status !== "ready" || state.distributive === null) return null;
        const preferredWorldName = worldName?.trim();
        const saves = preferredWorldName === undefined || preferredWorldName.length === 0 ? state.saves : await readSaveSummary(state.distributive.userdataPath, preferredWorldName);
        return {
            install: state.distributive,
            saves,
            gameRunning: this.runtimeState.status === "running",
            savesStable: state.distributive.id !== this.activeSaveMonitorInstallId ? true : this.activeSaveStable
        };
    }

    private async getStateWithLatestRelease(latestRelease: GithubRelease | null): Promise<DistributiveState> {
        const state = await this.getState(false);
        if (state.status !== "ready") return state;
        return {
            ...state,
            latestRelease,
            latestReleaseError: null,
            updateAvailable: latestRelease !== null && state.distributive !== null && latestRelease.id !== state.distributive.id
        };
    }

    private async launchActiveInstallAsync(options: GameLaunchOptions): Promise<EGameLaunchResult> {
        if (this.runtimeState.status === "running") return { status: "already-running", runtime: this.runtimeState };
        const state = await this.getState(false);
        if (state.status !== "ready") return { status: "unavailable", message: this.t("game.error.repositoryNotReady") };
        if (state.distributive === null) return { status: "unavailable", message: this.t("game.error.notInstalled") };

        const executablePath = await this.resolveExecutablePath(state.distributive);
        if (executablePath === null)
            return {
                status: "unavailable",
                message: this.t("game.error.executableMissing")
            };

        await mkdir(state.distributive.userdataPath, { recursive: true });
        const args = ["--userdir", state.distributive.userdataPath];
        const worldName = options.worldName?.trim();
        if (worldName !== undefined && worldName.length > 0) args.push("--world", worldName);
        const child = spawn(executablePath, args, { cwd: dirname(executablePath), stdio: "ignore" });
        this.gameProcess = child;
        this.preferredWorldByInstallId.set(state.distributive.id, worldName ?? null);
        await this.updateActiveSaveMonitor(state.distributive);
        const runtime = this.setRuntime({ status: "running", pid: child.pid ?? 0, installId: state.distributive.id, worldName: worldName ?? null });
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

    private async resolveExecutablePath(install: Distributive): Promise<string | null> {
        const manifestExecutablePath = install.manifest.executablePath;
        if (manifestExecutablePath !== null && (await pathExists(manifestExecutablePath))) return manifestExecutablePath;
        return findExecutable(install.path);
    }

    private async installRelease(repositoryPath: string, config: RepositoryConfig, channel: GameChannelDefinition, release: GithubRelease, options: InstallDistributiveOptions, installsBefore: Distributive[]): Promise<Distributive> {
        const installPath = join(repositoryPath, INSTALLS_DIRECTORY_NAME, channel.id, safePathSegment(release.id));
        const userdataPath = join(repositoryPath, USERDATA_DIRECTORY_NAME, channel.id, safePathSegment(release.id));
        const tempPath = `${installPath}.tmp-${Date.now()}`;
        const downloadPath = join(repositoryPath, DOWNLOADS_DIRECTORY_NAME, channel.id, basename(release.asset.name));
        await mkdir(dirname(installPath), { recursive: true });
        await mkdir(dirname(userdataPath), { recursive: true });
        await rm(tempPath, { recursive: true, force: true });
        await rm(installPath, { recursive: true, force: true });
        await this.downloadFile(release.asset.downloadUrl, downloadPath, release.name, release.asset.size);
        await this.extractArchive(downloadPath, tempPath, release.name);
        const executablePath = await findExecutable(tempPath);
        const sourceUserdata = options.copyUserdata ? findUserdataSource(installsBefore, config.activeInstallByChannel[channel.id]) : null;
        this.setProgress({ status: "preparing-saves", releaseName: release.name });
        await mkdir(userdataPath, { recursive: true });
        if (sourceUserdata !== null && (await pathExists(sourceUserdata.userdataPath))) await copyDirectoryContents(sourceUserdata.userdataPath, userdataPath);
        const manifest: DistributiveInfo = {
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

    private async readInstallsAndRepairConfig(repositoryPath: string, config: RepositoryConfig, channelId: string): Promise<{ config: RepositoryConfig; installs: Distributive[] }> {
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

    private async readInstalls(repositoryPath: string, config: RepositoryConfig, channelId: string): Promise<Distributive[]> {
        const channelInstallsPath = join(repositoryPath, INSTALLS_DIRECTORY_NAME, channelId);
        const activeInstallId = config.activeInstallByChannel[channelId] ?? null;
        let entries: string[];
        try {
            entries = await readdir(channelInstallsPath);
        } catch (error) {
            if (isNodeError(error) && error.code === "ENOENT") return [];
            throw error;
        }
        const installs: Distributive[] = [];
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

    private async findLatestRelease(channel: GameChannelDefinition, forceRefresh: boolean): Promise<GithubRelease | null> {
        return (await this.fetchReleases(channel, forceRefresh))[0] ?? null;
    }

    private async fetchReleases(channel: GameChannelDefinition, forceRefresh: boolean): Promise<GithubRelease[]> {
        const gameAssetVariant = (await this.repositoryService.getUserSettings()).releaseAssetVariant;
        return this.gitHubNetwork.getCached(getReleaseCacheKey(channel, gameAssetVariant), () => this.fetchReleasesFromGitHub(channel, forceRefresh, gameAssetVariant), { forceRefresh });
    }

    private async fetchReleasesFromGitHub(channel: GameChannelDefinition, forceRefresh: boolean, gameAssetVariant: TReleaseAssetVariant): Promise<GithubRelease[]> {
        const pageCount = channel.kind === "stable" ? 5 : 1;
        const releases: GithubRelease[] = [];
        for (let page = 1; page <= pageCount; page += 1) {
            const value = await this.fetchReleasePage(channel, page, forceRefresh);
            if (!Array.isArray(value) || value.length === 0) break;
            releases.push(
                ...value
                    .map((item) => toGameRelease(item, channel, gameAssetVariant))
                    .filter((item): item is GithubRelease => item !== null)
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

    private async downloadFile(url: string, targetPath: string, releaseName: string, expectedBytes: number): Promise<void> {
        const reusableArchive = await getReusableArchive(targetPath, expectedBytes);
        if (reusableArchive !== null) {
            this.setProgress({
                status: "downloading",
                releaseName,
                percent: 100,
                transferredBytes: reusableArchive.size,
                totalBytes: reusableArchive.size
            });
            console.info(`[game-install] reuse downloaded archive path=${targetPath} size=${reusableArchive.size}`);
            return;
        }

        const temporaryPath = `${targetPath}.tmp-${Date.now()}`;
        const response = isGitHubUrl(url) ? await this.gitHubNetwork.fetch(url) : await fetch(url);
        if (!response.ok || response.body === null) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        const totalBytes = Number(response.headers.get("content-length"));
        const knownTotalBytes = Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : expectedBytes > 0 ? expectedBytes : null;
        let transferredBytes = 0;
        this.setProgress({
            status: "downloading",
            releaseName,
            percent: null,
            transferredBytes,
            totalBytes: knownTotalBytes
        });
        await mkdir(dirname(targetPath), { recursive: true });
        await rm(temporaryPath, { force: true });
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

async function getReusableArchive(path: string, expectedBytes: number): Promise<{ size: number } | null> {
    try {
        const archiveStat = await stat(path);
        if (!archiveStat.isFile() || archiveStat.size <= 0) return null;
        if (expectedBytes > 0 && archiveStat.size !== expectedBytes) {
            console.warn(`[game-install] cached archive size mismatch path=${path} actual=${archiveStat.size} expected=${expectedBytes}`);
            return null;
        }
        const now = new Date();
        await utimes(path, now, now);
        return { size: archiveStat.size };
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return null;
        throw error;
    }
}
