import { mkdir } from "node:fs/promises";

import { GithubRelease } from "../shared/GithubRelease";
import { EBackupCreateResult } from "../shared/backups/types/EBackupCreateResult";
import { EBackupDeleteResult } from "../shared/backups/types/EBackupDeleteResult";
import { EBackupRenameResult } from "../shared/backups/types/EBackupRenameResult";
import { EBackupRestoreResult } from "../shared/backups/types/EBackupRestoreResult";
import { CreateManualBackupOptions } from "../shared/backups/types/CreateManualBackupOptions";
import { GameBundle } from "../shared/game-bundle/GameBundle";
import { GameBundleDeleteOptions } from "../shared/game-bundle/GameBundleDeleteOptions";
import { EGameBundleDeleteResult } from "../shared/game-bundle/EGameBundleDeleteResult";
import { EGameBundleInstallResult } from "../shared/game-bundle/EGameBundleInstallResult";
import { GameBundleInstallOptions } from "../shared/game-bundle/GameBundleInstallOptions";
import { EGameBundleSetActiveResult } from "../shared/game-bundle/EGameBundleSetActiveResult";
import { GameBundleState } from "../shared/game-bundle/GameBundleState";
import { GameFileOperationState } from "../shared/game-bundle/GameFileOperationState";
import { GameLaunchOptions } from "../shared/launch/GameLaunchOptions";
import { EGameLaunchResult } from "../shared/launch/EGameLaunchResult";
import { EGameStopResult } from "../shared/launch/EGameStopResult";
import { GameRuntimeState } from "../shared/GameRuntimeState";
import { RepositoryConfig } from "../shared/RepositoryConfig";
import { GameBackupService } from "./GameBackupService";
import { LocalizationService } from "./LocalizationService";
import { GameBundleRegistry } from "./game/GameBundleRegistry";
import { GameEvents } from "./game/GameEvents";
import { GameFileOperationGuard } from "./game/GameFileOperationGuard";
import { GameReleaseService } from "./game/GameReleaseService";
import { GameRuntimeService } from "./game/GameRuntimeService";
import { GameSaveCoordinator } from "./game/GameSaveCoordinator";
import { WorkspaceService } from "./repository/WorkspaceService";
import { readSaveSummary } from "./utils/saves/readSaveSummary";
import { GameChannelDefinition } from "../shared/game-channel/GameChannelDefinition";
import { BUILT_IN_GAME_CHANNELS } from "../shared/game-channel/BUILT_IN_GAME_CHANNELS";
import { DEFAULT_GAME_CHANNEL_ID } from "../shared/Const";

export class GameBundleService {
    private readonly events: GameEvents;
    private readonly registry: GameBundleRegistry;
    private readonly releases: GameReleaseService;
    private readonly runtime: GameRuntimeService;
    private readonly operations: GameFileOperationGuard;
    private readonly backups: GameBackupService;
    private readonly saves: GameSaveCoordinator;

    constructor(
        private readonly workspaceService: WorkspaceService,
        private readonly localizationService: LocalizationService
    ) {
        this.events = new GameEvents();
        this.registry = new GameBundleRegistry(workspaceService);
        this.releases = new GameReleaseService(workspaceService, this.registry, this.events);
        this.runtime = new GameRuntimeService(this.events, localizationService);
        this.operations = new GameFileOperationGuard(this.events, localizationService);
        this.backups = new GameBackupService(workspaceService, localizationService, this.events);
        this.saves = new GameSaveCoordinator(
            workspaceService,
            this.backups,
            this.events,
            () => this.getState(false),
            () => this.runtime.getState()
        );
    }

    async getState(refreshLatest = false, forceRefresh = false): Promise<GameBundleState> {
        const repository = await this.workspaceService.getWorkspaceStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: this.localizationService.t("game.error.repository.not.ready") };

        const channel = this.getSelectedChannel(repository.config);
        const { gameBundles } = await this.registry.readAndRepair(repository.path, repository.config, channel.id);
        const activeGameBundle = gameBundles.find((gameBundle) => gameBundle.isActive) ?? null;
        const latest = await this.readLatestRelease(channel, refreshLatest, forceRefresh);
        await this.saves.updateActiveGameBundle(activeGameBundle);

        return {
            status: "ready",
            repositoryPath: repository.path,
            channel,
            gameBundle: activeGameBundle,
            gameBundles,
            latestRelease: latest.release,
            latestReleaseError: latest.error,
            updateAvailable: latest.release !== null && activeGameBundle !== null && latest.release.id !== activeGameBundle.id,
            saves: activeGameBundle === null ? null : await readSaveSummary(activeGameBundle.userdataPath, this.runtime.getPreferredWorld(activeGameBundle.id)),
            backups: await this.backups.getSummary(activeGameBundle),
            runtimeState: this.runtime.getState(),
            savesStable: this.saves.getSavesStable(activeGameBundle)
        };
    }

    async getStateAndEmit(refreshLatest = false, forceRefresh = false): Promise<GameBundleState> {
        const state = await this.getState(refreshLatest, forceRefresh);
        this.events.emitGameState(state);
        return state;
    }

    async getReleases(forceRefresh = false): Promise<GithubRelease[]> {
        const repository = await this.workspaceService.getWorkspaceStatus();
        return repository.status === "ready" ? this.releases.fetch(this.getSelectedChannel(repository.config), forceRefresh) : [];
    }

    async installLatestGameBundle(options: GameBundleInstallOptions): Promise<EGameBundleInstallResult> {
        return this.operations.run("installing-bundle", () => this.installLatestGameBundleUnlocked(options));
    }

    async setActiveGameBundle(gameBundleId: string): Promise<EGameBundleSetActiveResult> {
        return this.operations.run("activating-bundle", () => this.setActiveGameBundleUnlocked(gameBundleId));
    }

    async deleteGameBundle(gameBundleId: string, options: GameBundleDeleteOptions): Promise<EGameBundleDeleteResult> {
        return this.operations.run("deleting-bundle", () => this.deleteGameBundleUnlocked(gameBundleId, options));
    }

    async launchActiveGameBundle(options: GameLaunchOptions = {}): Promise<EGameLaunchResult> {
        if (this.operations.isRunning()) return this.operations.busyResult<EGameLaunchResult>();
        const state = await this.getState(false);
        if (state.status !== "ready") return { status: "unavailable", message: this.localizationService.t("game.error.repository.not.ready") };
        const result = await this.runtime.launch(state.gameBundle, options, (gameBundle) => this.saves.updateActiveGameBundle(gameBundle));
        if (result.status === "launched" || result.status === "already-running") void this.emitState(false);
        return result;
    }

    stopGame(): EGameStopResult {
        const result = this.runtime.stop();
        if (result.status === "stopped" || result.status === "not-running") void this.emitState(false);
        return result;
    }

    getRuntimeState(): GameRuntimeState {
        return this.runtime.getState();
    }

    getFileOperation(): GameFileOperationState {
        return this.operations.getState();
    }

    async getGameBundleFolder(gameBundleId: string): Promise<string | null> {
        const gameBundle = await this.findGameBundle(gameBundleId);
        return gameBundle?.path ?? null;
    }

    async getSavesFolder(gameBundleId: string): Promise<string | null> {
        const gameBundle = await this.findGameBundle(gameBundleId);
        if (gameBundle === null) return null;
        await mkdir(gameBundle.userdataPath, { recursive: true });
        return gameBundle.userdataPath;
    }

    async createManualBackup(options: CreateManualBackupOptions = {}): Promise<EBackupCreateResult> {
        return this.operations.run("creating-backup", async () => {
            const context = await this.saves.getBackupContext(options.worldName);
            if (context === null) return { status: "unavailable", message: this.localizationService.t("game.error.no.game.bundle") };
            const result = await this.backups.createManualBackup(context);
            if (result.status === "created") this.saves.touchAutoBackupCooldown(context.gameBundle.id, result.backup.worldFolderName);
            return result;
        });
    }

    async restoreBackup(backupId: string): Promise<EBackupRestoreResult> {
        return this.operations.run("restoring-backup", async () => {
            const context = await this.saves.getBackupContext();
            if (context === null) return { status: "unavailable", message: this.localizationService.t("game.error.no.game.bundle") };
            const result = await this.backups.restoreBackup(context, backupId);
            if (result.status === "restored") void this.emitState(false);
            return result;
        });
    }

    async deleteBackup(backupId: string): Promise<EBackupDeleteResult> {
        return this.operations.run("deleting-backup", async () => {
            const context = await this.saves.getBackupContext();
            return this.backups.deleteBackup(context?.gameBundle ?? null, backupId);
        });
    }

    async renameBackup(backupId: string, comment: string): Promise<EBackupRenameResult> {
        return this.operations.run("renaming-backup", async () => {
            const context = await this.saves.getBackupContext();
            return this.backups.renameBackup(context?.gameBundle ?? null, backupId, comment);
        });
    }

    getEffectiveGameChannels(customChannels: GameChannelDefinition[] = []): GameChannelDefinition[] {
        const customIds = new Set(customChannels.map((channel) => channel.id));
        return [...BUILT_IN_GAME_CHANNELS.filter((channel) => !customIds.has(channel.id)), ...customChannels];
    }

    private getSelectedChannel(config: RepositoryConfig): GameChannelDefinition {
        const gameChannels = this.getEffectiveGameChannels(config.customGameChannels);
        const selectedChannelId = config.selectedChannelId || DEFAULT_GAME_CHANNEL_ID;
        return (
            gameChannels.find((channel) => channel.id === selectedChannelId) ?? //
            gameChannels.find((channel) => channel.id === DEFAULT_GAME_CHANNEL_ID) ??
            gameChannels[0] ??
            null
        );
    }

    private async installLatestGameBundleUnlocked(options: GameBundleInstallOptions): Promise<EGameBundleInstallResult> {
        this.events.emitInstallProgress({ status: "resolving-release" }, true);
        const repository = await this.workspaceService.getWorkspaceStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: this.localizationService.t("game.error.repository.not.ready") };

        try {
            const channel = this.getSelectedChannel(repository.config);
            const releases = await this.releases.fetch(channel, false);
            const release = options.releaseId === undefined ? releases[0] : releases.find((candidate) => candidate.id === options.releaseId);
            if (release === undefined) return this.installError(this.localizationService.t("game.error.no.compatible.release.asset"));

            const gameBundlesBefore = await this.registry.read(repository.path, repository.config, channel.id);
            const existingGameBundle = gameBundlesBefore.find((gameBundle) => gameBundle.id === release.id);
            if (existingGameBundle !== undefined) {
                if (options.makeActive) await this.setActiveGameBundleUnlocked(existingGameBundle.id);
                this.completeInstall(release.name);
                await this.emitStateWithLatestRelease(releases[0] ?? null);
                return { status: "installed", bundle: existingGameBundle };
            }

            const gameBundle = await this.releases.install(repository.path, repository.config, channel, release, options, gameBundlesBefore);
            const config = await this.activateInstalledBundleIfNeeded(repository.path, repository.config, channel.id, gameBundle.id, options.makeActive);
            if (options.removeOlderGameBundles) await this.registry.removeOlder(repository.path, config, channel.id, gameBundle.id, true);
            await this.releases.cleanupDownloads(repository.path, channel.id);
            this.completeInstall(release.name);
            await this.emitStateWithLatestRelease(releases[0] ?? null);
            return { status: "installed", bundle: gameBundle };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error("[game-bundle] failed to install game bundle release", error);
            this.events.emitInstallProgress({ status: "error", message }, true);
            return { status: "error", message };
        }
    }

    private async setActiveGameBundleUnlocked(gameBundleId: string): Promise<EGameBundleSetActiveResult> {
        const repository = await this.workspaceService.getWorkspaceStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: this.localizationService.t("game.error.repository.not.ready") };
        const channel = this.getSelectedChannel(repository.config);
        const gameBundles = await this.registry.read(repository.path, repository.config, channel.id);
        if (!gameBundles.some((gameBundle) => gameBundle.id === gameBundleId)) return { status: "error", message: this.localizationService.t("game.error.game.bundle.missing") };
        await this.activateBundle(repository.path, repository.config, channel.id, gameBundleId);
        await this.emitStateWithLatestRelease(await this.safeFindLatest(channel));
        return { status: "updated" };
    }

    private async deleteGameBundleUnlocked(gameBundleId: string, options: GameBundleDeleteOptions): Promise<EGameBundleDeleteResult> {
        const repository = await this.workspaceService.getWorkspaceStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: this.localizationService.t("game.error.repository.not.ready") };
        const channel = this.getSelectedChannel(repository.config);
        const gameBundle = (await this.registry.read(repository.path, repository.config, channel.id)).find((candidate) => candidate.id === gameBundleId);
        if (gameBundle === undefined) return { status: "error", message: this.localizationService.t("game.error.game.bundle.missing") };
        if (gameBundle.isActive) return { status: "blocked", message: this.localizationService.t("game.error.active.game.bundle.delete.blocked") };
        await this.registry.delete(gameBundle, options.deleteUserdata);
        await this.emitState(false);
        return { status: "deleted" };
    }

    private async emitState(refreshLatest = false, forceRefresh = false): Promise<GameBundleState> {
        const state = await this.getState(refreshLatest, forceRefresh);
        this.events.emitGameState(state);
        return state;
    }

    private async findGameBundle(gameBundleId: string): Promise<GameBundle | null> {
        const state = await this.getState(false);
        return state.status === "ready" ? (state.gameBundles.find((gameBundle) => gameBundle.id === gameBundleId) ?? null) : null;
    }

    private async emitStateWithLatestRelease(latestRelease: GithubRelease | null): Promise<void> {
        const state = await this.getState(false);
        this.events.emitGameState(
            state.status !== "ready" ? state : { ...state, latestRelease, latestReleaseError: null, updateAvailable: latestRelease !== null && state.gameBundle !== null && latestRelease.id !== state.gameBundle.id }
        );
    }

    private async readLatestRelease(channel: GameChannelDefinition, refreshLatest: boolean, forceRefresh: boolean): Promise<{ release: GithubRelease | null; error: string | null }> {
        if (!refreshLatest) return { release: null, error: null };
        try {
            return { release: await this.releases.findLatest(channel, forceRefresh), error: null };
        } catch (error) {
            console.error("[game-bundle] failed to check latest release", { channelId: channel.id, error });
            return { release: null, error: error instanceof Error ? error.message : String(error) };
        }
    }

    private async safeFindLatest(channel: GameChannelDefinition): Promise<GithubRelease | null> {
        try {
            return await this.releases.findLatest(channel, false);
        } catch (error) {
            console.error("[game-bundle] failed to check latest release after state change", { channelId: channel.id, error });
            return null;
        }
    }

    private async activateInstalledBundleIfNeeded(repositoryPath: string, config: RepositoryConfig, channelId: string, gameBundleId: string, makeActive: boolean): Promise<RepositoryConfig> {
        return makeActive ? this.activateBundle(repositoryPath, config, channelId, gameBundleId) : config;
    }

    private async activateBundle(repositoryPath: string, config: RepositoryConfig, channelId: string, gameBundleId: string): Promise<RepositoryConfig> {
        const nextConfig = { ...config, activeGameBundleByChannel: { ...config.activeGameBundleByChannel, [channelId]: gameBundleId } };
        await this.workspaceService.saveConfig(repositoryPath, nextConfig);
        return nextConfig;
    }

    private completeInstall(releaseName: string): void {
        this.events.emitInstallProgress({ status: "completed", releaseName }, true);
        queueMicrotask(() => this.events.emitInstallProgress({ status: "idle" }, true));
    }

    private installError(message: string): EGameBundleInstallResult {
        this.events.emitInstallProgress({ status: "idle" }, true);
        return { status: "error", message };
    }
}
