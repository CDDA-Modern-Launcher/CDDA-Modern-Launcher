import { type ChildProcess, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";

import extractZip from "extract-zip";

import { RepositoryConfig } from "../shared/RepositoryConfig";
import type { LocalizationService } from "./LocalizationService";
import { GitHubNetworkManager } from "./network/GitHubNetworkManager";
import { WorkspaceService } from "./repository/WorkspaceService";
import { type GameBackupContext, GameBackupService } from "./GameBackupService";
import { GameSaveMonitor, type GameSaveSettledActivity } from "./GameSaveMonitor";
import { EBackupCreateResult } from "../shared/backups/types/EBackupCreateResult";
import { EBackupDeleteResult } from "../shared/backups/types/EBackupDeleteResult";
import { toAutoBackupCooldownMs } from "../shared/backups/toAutoBackupCooldownMs";
import { EBackupRestoreResult } from "../shared/backups/types/EBackupRestoreResult";

import { EBackupRenameResult } from "../shared/backups/types/EBackupRenameResult";
import { TReleaseAssetVariant } from "../shared/release-asset/TReleaseAssetVariant";
import { GameChannelDefinition } from "../shared/game-channel/GameChannelDefinition";
import { DOWNLOADS_DIRECTORY_NAME, GAME_BUNDLE_MANIFEST_FILE_NAME, GAME_BUNDLES_DIRECTORY_NAME, USERDATA_DIRECTORY_NAME } from "../shared/Const";
import { GithubRelease } from "../shared/GithubRelease";
import { GameBundleManifest } from "../shared/game-bundle/GameBundleManifest";
import { GameBundle } from "../shared/game-bundle/GameBundle";
import { GameSaveSummaryUpdate } from "../shared/GameSaveSummaryUpdate";
import { GameRuntimeState } from "../shared/GameRuntimeState";
import { GameLaunchOptions } from "../shared/launch/GameLaunchOptions";
import { CreateManualBackupOptions } from "../shared/backups/types/CreateManualBackupOptions";
import { GameBundleState } from "../shared/game-bundle/GameBundleState";
import { GameBundleInstallOptions } from "../shared/game-bundle/GameBundleInstallOptions";
import { GameBundleDeleteOptions } from "../shared/game-bundle/GameBundleDeleteOptions";
import { EGameBundleInstallResult } from "../shared/game-bundle/EGameBundleInstallResult";
import { EGameBundleSetActiveResult } from "../shared/game-bundle/EGameBundleSetActiveResult";
import { EGameBundleDeleteResult } from "../shared/game-bundle/EGameBundleDeleteResult";
import { EGameLaunchResult } from "../shared/launch/EGameLaunchResult";
import { EGameStopResult } from "../shared/launch/EGameStopResult";
import { GameBundleInstallProgress } from "../shared/game-bundle/GameBundleInstallProgress";
import { GameFileOperationKind, GameFileOperationState } from "../shared/game-bundle/GameFileOperationState";
import { isNodeError } from "./utils/isNodeError";
import { BrowserWindow } from "electron";
import { Bridge } from "../shared/bridge-api/Bridge";
import { getReusableArchive } from "./utils/getReusableArchive";
import { getAutoBackupTimerKey } from "./utils/saves/getAutoBackupTimerKey";
import { isAutoBackupInCooldown } from "./utils/saves/isAutoBackupInCooldown";
import { getChangedWorldFolderNames } from "./utils/saves/getChangedWorldFolderNames";
import { readSaveSummary } from "./utils/saves/readSaveSummary";
import { getReleaseCacheKey } from "./utils/releases/getReleaseCacheKey";
import { withGitHubPageSize } from "./utils/releases/withGitHubPageSize";
import { matchesChannelKind } from "./utils/releases/matchesChannelKind";
import { toGameRelease } from "./utils/releases/toGameRelease";
import { isGitHubUrl } from "./utils/releases/isGitHubUrl";
import { getSelectedChannel } from "./utils/getSelectedChannel";
import { safePathSegment } from "./utils/safePathSegment";
import { isGameBundleManifest } from "./utils/isGameBundleManifest";
import { findExecutable } from "./utils/findExecutable";
import { findUserdataSource } from "./utils/findUserdataSource";
import { resolveUserdataPath } from "./utils/resolveUserdataPath";
import { copyDirectoryContents } from "./utils/copyDirectoryContents";
import { pathExists } from "./utils/pathExists";
import { runCommand } from "./utils/runCommand";

const KEEP_DOWNLOADED_GAME_BUNDLES = 3;

export class GameBundleService {
    private runtimeState: GameRuntimeState = { status: "idle" };
    private gameProcess: ChildProcess | null = null;
    private readonly gitHubNetwork = new GitHubNetworkManager();
    private readonly backupService: GameBackupService;
    private activeSaveMonitor: GameSaveMonitor | null = null;
    private activeSaveMonitorGameBundleId: string | null = null;
    private readonly preferredWorldByGameBundleId = new Map<string, string | null>();
    private readonly latestBackupAtByWorld = new Map<string, number>();
    private fileOperation: GameFileOperationState = { status: "idle" };
    private lastInstallProgressKey = "";
    private lastInstallProgressAt = 0;

    constructor(
        private readonly repositoryService: WorkspaceService,
        private readonly localizationService: LocalizationService
    ) {
        this.backupService = new GameBackupService(repositoryService, localizationService);
    }

    async getState(refreshLatest = false, forceRefresh = false): Promise<GameBundleState> {
        const repository = await this.repositoryService.getWorkspaceStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: this.localizationService.t("game.error.repositoryNotReady") };
        const channel = getSelectedChannel(repository.config);
        const { gameBundles } = await this.readGameBundlesAndRepairConfig(repository.path, repository.config, channel.id);
        const activeGameBundle = gameBundles.find((gameBundle) => gameBundle.isActive) ?? null;
        let latestRelease: GithubRelease | null = null;
        let latestReleaseError: string | null = null;

        if (refreshLatest) {
            try {
                latestRelease = await this.findLatestRelease(channel, forceRefresh);
            } catch (error) {
                latestReleaseError = error instanceof Error ? error.message : String(error);
                console.error("[game-bundle] failed to check latest release", { channelId: channel.id, error });
            }
        }

        await this.updateActiveSaveMonitor(activeGameBundle);

        return {
            status: "ready",
            repositoryPath: repository.path,
            channel,
            gameBundle: activeGameBundle,
            gameBundles: gameBundles,
            latestRelease,
            latestReleaseError,
            updateAvailable: latestRelease !== null && activeGameBundle !== null && latestRelease.id !== activeGameBundle.id,
            saves: activeGameBundle === null ? null : await readSaveSummary(activeGameBundle.userdataPath, this.preferredWorldByGameBundleId.get(activeGameBundle.id) ?? null),
            backups: await this.backupService.getSummary(activeGameBundle),
            runtimeState: this.runtimeState,
            savesStable: activeGameBundle === null || activeGameBundle.id !== this.activeSaveMonitorGameBundleId ? true : this.isActiveSaveStable()
        };
    }

    async getReleases(forceRefresh = false): Promise<GithubRelease[]> {
        const repository = await this.repositoryService.getWorkspaceStatus();
        return repository.status === "ready" ? this.fetchReleases(getSelectedChannel(repository.config), forceRefresh) : [];
    }

    async setActiveGameBundle(gameBundleId: string): Promise<EGameBundleSetActiveResult> {
        return this.withFileOperation("activating-bundle", () => this.setActiveGameBundleUnlocked(gameBundleId));
    }

    async deleteGameBundle(gameBundleId: string, options: GameBundleDeleteOptions): Promise<EGameBundleDeleteResult> {
        return this.withFileOperation("deleting-bundle", () => this.deleteGameBundleUnlocked(gameBundleId, options));
    }

    async installLatestGameBundle(options: GameBundleInstallOptions): Promise<EGameBundleInstallResult> {
        return this.withFileOperation("installing-bundle", () => this.installLatestGameBundleUnlocked(options));
    }

    async launchActiveGameBundle(options: GameLaunchOptions = {}): Promise<EGameLaunchResult> {
        if (this.fileOperation.status === "running") return { status: "blocked", message: this.localizationService.t("game.error.fileOperationBusy") };
        return this.launchActiveGameBundleAsync(options);
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

    async getGameBundleFolder(gameBundleId: string): Promise<string | null> {
        const state = await this.getState(false);
        if (state.status !== "ready") return null;
        return state.gameBundles.find((gameBundle) => gameBundle.id === gameBundleId)?.path ?? null;
    }

    async getSavesFolder(gameBundleId: string): Promise<string | null> {
        const state = await this.getState(false);
        if (state.status !== "ready") return null;
        const path = state.gameBundles.find((gameBundle) => gameBundle.id === gameBundleId)?.userdataPath ?? null;
        if (path !== null) await mkdir(path, { recursive: true });
        return path;
    }

    async createManualBackup(options: CreateManualBackupOptions = {}): Promise<EBackupCreateResult> {
        return this.withFileOperation("creating-backup", () => this.createManualBackupUnlocked(options));
    }

    async restoreBackup(backupId: string): Promise<EBackupRestoreResult> {
        return this.withFileOperation("restoring-backup", () => this.restoreBackupUnlocked(backupId));
    }

    async deleteBackup(backupId: string): Promise<EBackupDeleteResult> {
        return this.withFileOperation("deleting-backup", async () => {
            const context = await this.getBackupContext();
            return this.backupService.deleteBackup(context?.gameBundle ?? null, backupId);
        });
    }

    async renameBackup(backupId: string, comment: string): Promise<EBackupRenameResult> {
        return this.withFileOperation("renaming-backup", async () => {
            const context = await this.getBackupContext();
            return this.backupService.renameBackup(context?.gameBundle ?? null, backupId, comment);
        });
    }

    getFileOperation(): GameFileOperationState {
        return this.fileOperation;
    }

    private async setActiveGameBundleUnlocked(gameBundleId: string): Promise<EGameBundleSetActiveResult> {
        const repository = await this.repositoryService.getWorkspaceStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: this.localizationService.t("game.error.repositoryNotReady") };
        const channel = getSelectedChannel(repository.config);
        const gameBundles = await this.readGameBundles(repository.path, repository.config, channel.id);
        if (!gameBundles.some((gameBundle) => gameBundle.id === gameBundleId)) return { status: "error", message: this.localizationService.t("game.error.gameBundleMissing") };
        await this.repositoryService.saveConfig(repository.path, {
            ...repository.config,
            activeGameBundleByChannel: {
                ...repository.config.activeGameBundleByChannel,
                [channel.id]: gameBundleId
            }
        });
        try {
            return { status: "updated", state: await this.getStateWithLatestRelease(await this.findLatestRelease(channel, false)) };
        } catch (error) {
            console.error("[game-bundle] failed to check latest release after active game bundle change", { channelId: channel.id, error });
            return { status: "updated", state: await this.getState(false) };
        }
    }

    private async deleteGameBundleUnlocked(gameBundleId: string, options: GameBundleDeleteOptions): Promise<EGameBundleDeleteResult> {
        const repository = await this.repositoryService.getWorkspaceStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: this.localizationService.t("game.error.repositoryNotReady") };
        const channel = getSelectedChannel(repository.config);
        const gameBundles = await this.readGameBundles(repository.path, repository.config, channel.id);
        const gameBundle = gameBundles.find((candidate) => candidate.id === gameBundleId);
        if (gameBundle === undefined) return { status: "error", message: this.localizationService.t("game.error.gameBundleMissing") };
        if (gameBundle.isActive)
            return {
                status: "blocked",
                message: this.localizationService.t("game.error.activeGameBundleDeleteBlocked")
            };
        await rm(gameBundle.path, { recursive: true, force: true });
        if (options.deleteUserdata) await rm(gameBundle.userdataPath, { recursive: true, force: true });
        return { status: "deleted", state: await this.getState(false) };
    }

    private async installLatestGameBundleUnlocked(options: GameBundleInstallOptions): Promise<EGameBundleInstallResult> {
        this.broadcastProgress({ status: "resolving-release" }, true);
        const repository = await this.repositoryService.getWorkspaceStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: this.localizationService.t("game.error.repositoryNotReady") };
        try {
            const channel = getSelectedChannel(repository.config);
            const releases = await this.fetchReleases(channel, false);
            const release = options.releaseId === undefined ? releases[0] : releases.find((candidate) => candidate.id === options.releaseId);
            if (release === undefined) {
                this.broadcastProgress({ status: "idle" });
                return {
                    status: "error",
                    message: this.localizationService.t("game.error.noCompatibleReleaseAsset")
                };
            }
            const gameBundlesBefore = await this.readGameBundles(repository.path, repository.config, channel.id);
            const existingGameBundle = gameBundlesBefore.find((gameBundle) => gameBundle.id === release.id);
            if (existingGameBundle !== undefined) {
                if (options.makeActive) await this.setActiveGameBundleUnlocked(existingGameBundle.id);
                this.broadcastProgress({ status: "completed", releaseName: release.name });
                queueMicrotask(() => this.broadcastProgress({ status: "idle" }));
                return {
                    status: "installed",
                    state: await this.getStateWithLatestRelease(releases[0] ?? null),
                    bundle: existingGameBundle
                };
            }
            const gameBundle = await this.installRelease(repository.path, repository.config, channel, release, options, gameBundlesBefore);
            let config = repository.config;
            if (options.makeActive) {
                config = {
                    ...config,
                    activeGameBundleByChannel: {
                        ...config.activeGameBundleByChannel,
                        [channel.id]: gameBundle.id
                    }
                };
                await this.repositoryService.saveConfig(repository.path, config);
            }
            if (options.removeOlderGameBundles) await this.removeOlderGameBundles(repository.path, config, channel.id, gameBundle.id, true);
            await this.cleanupDownloads(repository.path, channel.id);
            this.broadcastProgress({ status: "completed", releaseName: release.name });
            queueMicrotask(() => this.broadcastProgress({ status: "idle" }));
            return { status: "installed", state: await this.getStateWithLatestRelease(releases[0] ?? null), bundle: gameBundle };
        } catch (error) {
            console.error("[game-bundle] failed to install game bundle release", error);
            const message = error instanceof Error ? error.message : String(error);
            this.broadcastProgress({ status: "error", message });
            return { status: "error", message };
        }
    }

    private async createManualBackupUnlocked(options: CreateManualBackupOptions = {}): Promise<EBackupCreateResult> {
        const context = await this.getBackupContext(options.worldName);
        if (context === null) return { status: "unavailable", message: this.localizationService.t("game.error.noGameBundle") };
        const result = await this.backupService.createManualBackup(context);
        if (result.status === "created") this.touchAutoBackupCooldown(context.gameBundle.id, result.backup.worldFolderName);
        return result;
    }

    private async restoreBackupUnlocked(backupId: string): Promise<EBackupRestoreResult> {
        const context = await this.getBackupContext();
        if (context === null) return { status: "unavailable", message: this.localizationService.t("game.error.noGameBundle") };
        return this.backupService.restoreBackup(context, backupId);
    }

    private broadcastProgress(progress: GameBundleInstallProgress, immediate = false): void {
        if (!immediate && this.shouldThrottleInstallProgress(progress)) return;
        this.lastInstallProgressKey = this.getInstallProgressKey(progress);
        this.lastInstallProgressAt = Date.now();
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send(Bridge.Game.gameBundleInstallProgress, progress);
        }
    }

    private shouldThrottleInstallProgress(progress: GameBundleInstallProgress): boolean {
        const key = this.getInstallProgressKey(progress);
        const now = Date.now();
        return key === this.lastInstallProgressKey && now - this.lastInstallProgressAt < 120;
    }

    private getInstallProgressKey(progress: GameBundleInstallProgress): string {
        if (progress.status === "downloading") {
            if (progress.percent !== null) return `${progress.status}:${progress.percent}`;
            return `${progress.status}:${Math.floor(progress.transferredBytes / 1024 / 1024)}`;
        }
        if (progress.status === "extracting") return `${progress.status}:${progress.percent}`;
        return progress.status;
    }

    private async withFileOperation<T extends { status: string; message?: string }>(kind: GameFileOperationKind, action: () => Promise<T>): Promise<T> {
        if (this.fileOperation.status === "running") {
            return { status: "blocked", message: this.localizationService.t("game.error.fileOperationBusy") } as T;
        }
        this.setFileOperation({ status: "running", kind });
        try {
            return await action();
        } finally {
            this.setFileOperation({ status: "idle" });
        }
    }

    private setFileOperation(operation: GameFileOperationState): void {
        this.fileOperation = operation;
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send(Bridge.Game.fileOperationChanged, operation);
        }
    }

    private setRuntime(runtime: GameRuntimeState): GameRuntimeState {
        this.runtimeState = runtime;
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send(Bridge.Game.runtimeChanged, runtime);
        }
        return runtime;
    }

    private emitSaveSummaryChanged(update: GameSaveSummaryUpdate): void {
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send(Bridge.Game.saveSummaryChanged, update);
        }
    }

    private isActiveSaveStable(): boolean {
        if (!this.activeSaveMonitor) return true;
        return this.activeSaveMonitor.isStable();
    }

    private async updateActiveSaveMonitor(activeGameBundle: GameBundle | null): Promise<void> {
        if (activeGameBundle === null) {
            this.stopActiveSaveMonitor();
            await this.backupService.updateActiveGameBundle(null);
            return;
        }
        if (this.activeSaveMonitorGameBundleId === activeGameBundle.id) {
            await this.backupService.updateActiveGameBundle(activeGameBundle);
            return;
        }
        this.stopActiveSaveMonitor();
        const gameBundleId = activeGameBundle.id;
        const monitor = new GameSaveMonitor({
            gameBundleId,
            userdataPath: activeGameBundle.userdataPath,
            onSettled: (activity) => this.processSettledSaveActivity(gameBundleId, activity)
        });
        this.activeSaveMonitor = monitor;
        this.activeSaveMonitorGameBundleId = gameBundleId;
        await monitor.start();
        await this.backupService.updateActiveGameBundle(activeGameBundle);
    }

    private stopActiveSaveMonitor(): void {
        this.activeSaveMonitor?.stop();
        this.activeSaveMonitor = null;
        this.activeSaveMonitorGameBundleId = null;
        this.clearAutoBackupState();
    }

    private clearAutoBackupState(): void {
        this.latestBackupAtByWorld.clear();
    }

    private async processSettledSaveActivity(gameBundleId: string, activity: GameSaveSettledActivity): Promise<void> {
        console.info(`[game-save] refresh save summary gameBundleId=${gameBundleId} events=${activity.eventCount} changedPaths=${activity.changedPaths.length}`);
        const changedWorldFolderNames = getChangedWorldFolderNames(activity);
        const state = await this.getState(false);
        if (state.status !== "ready" || state.gameBundle?.id !== gameBundleId || state.saves === null) return;
        const update: GameSaveSummaryUpdate = { gameBundleId, saves: state.saves };
        this.emitSaveSummaryChanged(update);
        this.queueAutoBackupAfterSave(update, changedWorldFolderNames);
    }

    private queueAutoBackupAfterSave(update: GameSaveSummaryUpdate, changedWorldFolderNames: string[]): void {
        if (this.runtimeState.status !== "running") return;
        for (const worldFolderName of changedWorldFolderNames) {
            void this.createAutoBackupAfterSave(update, worldFolderName);
        }
    }

    private async createAutoBackupAfterSave(update: GameSaveSummaryUpdate, worldFolderName: string): Promise<void> {
        const settings = await this.repositoryService.getWorkspaceSettings();
        if (isAutoBackupInCooldown(this.latestBackupAtByWorld.get(getAutoBackupTimerKey(update.gameBundleId, worldFolderName)) ?? null, toAutoBackupCooldownMs(settings.autoBackupCooldown))) return;
        const context = await this.getBackupContext(worldFolderName);
        if (context === null || context.gameBundle.id !== update.gameBundleId) return;
        const result = await this.backupService.createAutoBackup(context);
        if (result.status === "created") this.touchAutoBackupCooldown(context.gameBundle.id, result.backup.worldFolderName);
    }

    private touchAutoBackupCooldown(gameBundleId: string, worldFolderName: string): void {
        this.latestBackupAtByWorld.set(getAutoBackupTimerKey(gameBundleId, worldFolderName), Date.now());
    }

    private async getBackupContext(worldName?: string): Promise<GameBackupContext | null> {
        const state = await this.getState(false);
        if (state.status !== "ready" || state.gameBundle === null) return null;
        const preferredWorldName = worldName?.trim();
        const saves = preferredWorldName === undefined || preferredWorldName.length === 0 ? state.saves : await readSaveSummary(state.gameBundle.userdataPath, preferredWorldName);
        return {
            gameBundle: state.gameBundle,
            saves,
            gameRunning: this.runtimeState.status === "running",
            savesStable: state.gameBundle.id !== this.activeSaveMonitorGameBundleId ? true : this.isActiveSaveStable()
        };
    }

    private async getStateWithLatestRelease(latestRelease: GithubRelease | null): Promise<GameBundleState> {
        const state = await this.getState(false);
        if (state.status !== "ready") return state;
        return {
            ...state,
            latestRelease,
            latestReleaseError: null,
            updateAvailable: latestRelease !== null && state.gameBundle !== null && latestRelease.id !== state.gameBundle.id
        };
    }

    private async launchActiveGameBundleAsync(options: GameLaunchOptions): Promise<EGameLaunchResult> {
        if (this.runtimeState.status === "running") return { status: "already-running", runtime: this.runtimeState };
        const state = await this.getState(false);
        if (state.status !== "ready") return { status: "unavailable", message: this.localizationService.t("game.error.repositoryNotReady") };
        if (state.gameBundle === null) return { status: "unavailable", message: this.localizationService.t("game.error.noGameBundle") };

        const executablePath = await this.resolveExecutablePath(state.gameBundle);
        if (executablePath === null)
            return {
                status: "unavailable",
                message: this.localizationService.t("game.error.executableMissing")
            };

        await mkdir(state.gameBundle.userdataPath, { recursive: true });
        const args = ["--userdir", state.gameBundle.userdataPath];
        const worldName = options.worldName?.trim();
        if (worldName !== undefined && worldName.length > 0) args.push("--world", worldName);

        // todo: runCommand.ts
        const child = spawn(executablePath, args, { cwd: dirname(executablePath), stdio: "ignore" });
        this.gameProcess = child;
        this.preferredWorldByGameBundleId.set(state.gameBundle.id, worldName ?? null);
        await this.updateActiveSaveMonitor(state.gameBundle);
        const runtime = this.setRuntime({ status: "running", pid: child.pid ?? 0, gameBundleId: state.gameBundle.id, worldName: worldName ?? null });
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

    private async resolveExecutablePath(gameBundle: GameBundle): Promise<string | null> {
        const manifestExecutablePath = gameBundle.manifest.executablePath;
        if (manifestExecutablePath !== null && (await pathExists(manifestExecutablePath))) return manifestExecutablePath;
        return findExecutable(gameBundle.path);
    }

    private async installRelease(
        repositoryPath: string,
        config: RepositoryConfig,
        channel: GameChannelDefinition,
        release: GithubRelease,
        options: GameBundleInstallOptions,
        gameBundlesBefore: GameBundle[]
    ): Promise<GameBundle> {
        const gameBundlePath = join(repositoryPath, GAME_BUNDLES_DIRECTORY_NAME, channel.id, safePathSegment(release.id));
        const userdataPath = join(repositoryPath, USERDATA_DIRECTORY_NAME, channel.id, safePathSegment(release.id));
        const tempPath = `${gameBundlePath}.tmp-${Date.now()}`;
        const downloadPath = join(repositoryPath, DOWNLOADS_DIRECTORY_NAME, channel.id, basename(release.asset.name));
        await mkdir(dirname(gameBundlePath), { recursive: true });
        await mkdir(dirname(userdataPath), { recursive: true });
        await rm(tempPath, { recursive: true, force: true });
        await rm(gameBundlePath, { recursive: true, force: true });
        await this.downloadFile(release.asset.downloadUrl, downloadPath, release.name, release.asset.size);
        await this.extractArchive(downloadPath, tempPath, release.name);
        const executablePath = await findExecutable(tempPath);
        const sourceUserdata = options.copyUserdata ? findUserdataSource(gameBundlesBefore, config.activeGameBundleByChannel[channel.id]) : null;
        this.broadcastProgress({ status: "preparing-saves", releaseName: release.name });
        await mkdir(userdataPath, { recursive: true });
        if (sourceUserdata !== null && (await pathExists(sourceUserdata.userdataPath))) await copyDirectoryContents(sourceUserdata.userdataPath, userdataPath);
        const manifest: GameBundleManifest = {
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
            executablePath: executablePath === null ? null : join(gameBundlePath, relative(tempPath, executablePath)),
            userdataPath,
            copiedUserdataFromGameBundleId: sourceUserdata?.id ?? null,
            source: {
                owner: channel.githubOwner,
                repo: channel.githubRepo,
                branch: channel.githubBranch
            }
        };
        this.broadcastProgress({ status: "finalizing", releaseName: release.name });
        await writeFile(join(tempPath, GAME_BUNDLE_MANIFEST_FILE_NAME), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
        await rename(tempPath, gameBundlePath);
        return {
            id: release.id,
            path: gameBundlePath,
            userdataPath,
            manifest,
            isActive: false
        };
    }

    private async readGameBundlesAndRepairConfig(repositoryPath: string, config: RepositoryConfig, channelId: string): Promise<{ config: RepositoryConfig; gameBundles: GameBundle[] }> {
        const gameBundles = await this.readGameBundles(repositoryPath, config, channelId);
        const activeGameBundleId = config.activeGameBundleByChannel[channelId] ?? null;
        const activeGameBundleExists = activeGameBundleId !== null && gameBundles.some((gameBundle) => gameBundle.id === activeGameBundleId);

        if (activeGameBundleId === null || activeGameBundleExists) return { config, gameBundles };

        const activeGameBundleByChannel = { ...config.activeGameBundleByChannel };
        delete activeGameBundleByChannel[channelId];
        const repairedConfig = { ...config, activeGameBundleByChannel };
        await this.repositoryService.saveConfig(repositoryPath, repairedConfig);
        return {
            config: repairedConfig,
            gameBundles: gameBundles.map((gameBundle) => ({ ...gameBundle, isActive: false }))
        };
    }

    private async readGameBundles(repositoryPath: string, config: RepositoryConfig, channelId: string): Promise<GameBundle[]> {
        const channelGameBundlesPath = join(repositoryPath, GAME_BUNDLES_DIRECTORY_NAME, channelId);
        const activeGameBundleId = config.activeGameBundleByChannel[channelId] ?? null;
        let entries: string[];
        try {
            entries = await readdir(channelGameBundlesPath);
        } catch (error) {
            if (isNodeError(error) && error.code === "ENOENT") return [];
            throw error;
        }
        const gameBundles: GameBundle[] = [];
        for (const entry of entries) {
            const gameBundlePath = join(channelGameBundlesPath, entry);
            try {
                if (!(await stat(gameBundlePath)).isDirectory()) continue;
                const manifest = JSON.parse(await readFile(join(gameBundlePath, GAME_BUNDLE_MANIFEST_FILE_NAME), "utf8")) as unknown;
                if (!isGameBundleManifest(manifest) || manifest.channelId !== channelId) continue;
                const userdataPath = resolveUserdataPath(repositoryPath, channelId, manifest);
                const normalizedManifest = manifest.userdataPath === userdataPath ? manifest : { ...manifest, userdataPath };
                gameBundles.push({
                    id: normalizedManifest.releaseId,
                    path: gameBundlePath,
                    userdataPath,
                    manifest: normalizedManifest,
                    isActive: normalizedManifest.releaseId === activeGameBundleId
                });
            } catch (error) {
                console.error(`[game-bundle] failed to read game bundle: ${gameBundlePath}`, error);
            }
        }
        return gameBundles.sort((a, b) => b.manifest.publishedAt.localeCompare(a.manifest.publishedAt));
    }

    private async findLatestRelease(channel: GameChannelDefinition, forceRefresh: boolean): Promise<GithubRelease | null> {
        return (await this.fetchReleases(channel, forceRefresh))[0] ?? null;
    }

    private async fetchReleases(channel: GameChannelDefinition, forceRefresh: boolean): Promise<GithubRelease[]> {
        const gameAssetVariant = (await this.repositoryService.getWorkspaceSettings()).releaseAssetVariant;
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
            this.broadcastProgress({
                status: "downloading",
                releaseName,
                percent: 100,
                transferredBytes: reusableArchive.size,
                totalBytes: reusableArchive.size
            });
            console.info(`[game-bundle] reuse downloaded archive path=${targetPath} size=${reusableArchive.size}`);
            return;
        }

        const temporaryPath = `${targetPath}.tmp-${Date.now()}`;
        const response = isGitHubUrl(url) ? await this.gitHubNetwork.fetch(url) : await fetch(url);
        if (!response.ok || response.body === null) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        const totalBytes = Number(response.headers.get("content-length"));
        const knownTotalBytes = Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : expectedBytes > 0 ? expectedBytes : null;
        let transferredBytes = 0;
        this.broadcastProgress({
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
            this.broadcastProgress({
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
        this.broadcastProgress({ status: "extracting", releaseName, percent });
        const timer = setInterval(() => {
            percent = Math.min(96, percent + Math.max(1, Math.round((96 - percent) * 0.16)));
            this.broadcastProgress({ status: "extracting", releaseName, percent });
        }, 450);
        try {
            if (archivePath.toLowerCase().endsWith(".zip")) {
                await extractZip(archivePath, { dir: targetPath });
            } else {
                await runCommand("tar", ["-xf", archivePath, "-C", targetPath]);
            }
            this.broadcastProgress({ status: "extracting", releaseName, percent: 100 });
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
            .slice(KEEP_DOWNLOADED_GAME_BUNDLES);
        await Promise.all(files.map((file) => rm(file.path, { force: true })));
    }

    private async removeOlderGameBundles(repositoryPath: string, config: RepositoryConfig, channelId: string, keepGameBundleId: string, deleteUserdata: boolean): Promise<void> {
        const gameBundles = await this.readGameBundles(repositoryPath, config, channelId);
        await Promise.all(
            gameBundles
                .filter((bundle) => bundle.id !== keepGameBundleId)
                .map(async (bundle) => {
                    await rm(bundle.path, { recursive: true, force: true });
                    if (deleteUserdata) await rm(bundle.userdataPath, { recursive: true, force: true });
                })
        );
    }
}
