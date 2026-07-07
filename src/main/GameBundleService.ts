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
import { getSelectedChannel } from "./utils/getSelectedChannel";
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
        if (repository.status !== "ready") return { status: "unavailable", message: this.localizationService.t("game.error.repositoryNotReady") };

        const channel = getSelectedChannel(repository.config);
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

    async getReleases(forceRefresh = false): Promise<GithubRelease[]> {
        const repository = await this.workspaceService.getWorkspaceStatus();
        return repository.status === "ready" ? this.releases.fetch(getSelectedChannel(repository.config), forceRefresh) : [];
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
        if (state.status !== "ready") return { status: "unavailable", message: this.localizationService.t("game.error.repositoryNotReady") };
        return this.runtime.launch(state.gameBundle, options, (gameBundle) => this.saves.updateActiveGameBundle(gameBundle));
    }

    stopGame(): EGameStopResult {
        return this.runtime.stop();
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
            if (context === null) return { status: "unavailable", message: this.localizationService.t("game.error.noGameBundle") };
            const result = await this.backups.createManualBackup(context);
            if (result.status === "created") this.saves.touchAutoBackupCooldown(context.gameBundle.id, result.backup.worldFolderName);
            return result;
        });
    }

    async restoreBackup(backupId: string): Promise<EBackupRestoreResult> {
        return this.operations.run("restoring-backup", async () => {
            const context = await this.saves.getBackupContext();
            if (context === null) return { status: "unavailable", message: this.localizationService.t("game.error.noGameBundle") };
            return this.backups.restoreBackup(context, backupId);
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

    private async installLatestGameBundleUnlocked(options: GameBundleInstallOptions): Promise<EGameBundleInstallResult> {
        this.events.emitInstallProgress({ status: "resolving-release" }, true);
        const repository = await this.workspaceService.getWorkspaceStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: this.localizationService.t("game.error.repositoryNotReady") };

        try {
            const channel = getSelectedChannel(repository.config);
            const releases = await this.releases.fetch(channel, false);
            const release = options.releaseId === undefined ? releases[0] : releases.find((candidate) => candidate.id === options.releaseId);
            if (release === undefined) return this.installError(this.localizationService.t("game.error.noCompatibleReleaseAsset"));

            const gameBundlesBefore = await this.registry.read(repository.path, repository.config, channel.id);
            const existingGameBundle = gameBundlesBefore.find((gameBundle) => gameBundle.id === release.id);
            if (existingGameBundle !== undefined) {
                if (options.makeActive) await this.setActiveGameBundleUnlocked(existingGameBundle.id);
                this.completeInstall(release.name);
                return { status: "installed", state: await this.getStateWithLatestRelease(releases[0] ?? null), bundle: existingGameBundle };
            }

            const gameBundle = await this.releases.install(repository.path, repository.config, channel, release, options, gameBundlesBefore);
            const config = await this.activateInstalledBundleIfNeeded(repository.path, repository.config, channel.id, gameBundle.id, options.makeActive);
            if (options.removeOlderGameBundles) await this.registry.removeOlder(repository.path, config, channel.id, gameBundle.id, true);
            await this.releases.cleanupDownloads(repository.path, channel.id);
            this.completeInstall(release.name);
            return { status: "installed", state: await this.getStateWithLatestRelease(releases[0] ?? null), bundle: gameBundle };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error("[game-bundle] failed to install game bundle release", error);
            this.events.emitInstallProgress({ status: "error", message }, true);
            return { status: "error", message };
        }
    }

    private async setActiveGameBundleUnlocked(gameBundleId: string): Promise<EGameBundleSetActiveResult> {
        const repository = await this.workspaceService.getWorkspaceStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: this.localizationService.t("game.error.repositoryNotReady") };
        const channel = getSelectedChannel(repository.config);
        const gameBundles = await this.registry.read(repository.path, repository.config, channel.id);
        if (!gameBundles.some((gameBundle) => gameBundle.id === gameBundleId)) return { status: "error", message: this.localizationService.t("game.error.gameBundleMissing") };
        await this.activateBundle(repository.path, repository.config, channel.id, gameBundleId);
        return { status: "updated", state: await this.getStateWithLatestRelease(await this.safeFindLatest(channel)) };
    }

    private async deleteGameBundleUnlocked(gameBundleId: string, options: GameBundleDeleteOptions): Promise<EGameBundleDeleteResult> {
        const repository = await this.workspaceService.getWorkspaceStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: this.localizationService.t("game.error.repositoryNotReady") };
        const channel = getSelectedChannel(repository.config);
        const gameBundle = (await this.registry.read(repository.path, repository.config, channel.id)).find((candidate) => candidate.id === gameBundleId);
        if (gameBundle === undefined) return { status: "error", message: this.localizationService.t("game.error.gameBundleMissing") };
        if (gameBundle.isActive) return { status: "blocked", message: this.localizationService.t("game.error.activeGameBundleDeleteBlocked") };
        await this.registry.delete(gameBundle, options.deleteUserdata);
        return { status: "deleted", state: await this.getState(false) };
    }

    private async findGameBundle(gameBundleId: string): Promise<GameBundle | null> {
        const state = await this.getState(false);
        return state.status === "ready" ? (state.gameBundles.find((gameBundle) => gameBundle.id === gameBundleId) ?? null) : null;
    }

    private async getStateWithLatestRelease(latestRelease: GithubRelease | null): Promise<GameBundleState> {
        const state = await this.getState(false);
        if (state.status !== "ready") return state;
        return { ...state, latestRelease, latestReleaseError: null, updateAvailable: latestRelease !== null && state.gameBundle !== null && latestRelease.id !== state.gameBundle.id };
    }

    private async readLatestRelease(channel: ReturnType<typeof getSelectedChannel>, refreshLatest: boolean, forceRefresh: boolean): Promise<{ release: GithubRelease | null; error: string | null }> {
        if (!refreshLatest) return { release: null, error: null };
        try {
            return { release: await this.releases.findLatest(channel, forceRefresh), error: null };
        } catch (error) {
            console.error("[game-bundle] failed to check latest release", { channelId: channel.id, error });
            return { release: null, error: error instanceof Error ? error.message : String(error) };
        }
    }

    private async safeFindLatest(channel: ReturnType<typeof getSelectedChannel>): Promise<GithubRelease | null> {
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
