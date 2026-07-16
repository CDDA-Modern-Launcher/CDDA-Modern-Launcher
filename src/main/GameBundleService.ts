import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";

import { GithubRelease } from "../shared/GithubRelease";
import { GameBundle } from "../shared/game-bundle/GameBundle";
import { GameBundleDeleteOptions } from "../shared/game-bundle/GameBundleDeleteOptions";
import { EGameBundleDeleteResult } from "../shared/game-bundle/EGameBundleDeleteResult";
import { EGameBundleInstallResult } from "../shared/game-bundle/EGameBundleInstallResult";
import { GameBundleInstallOptions } from "../shared/game-bundle/GameBundleInstallOptions";
import { EGameBundleSetActiveResult } from "../shared/game-bundle/EGameBundleSetActiveResult";
import { WorkspaceConfig } from "../shared/WorkspaceConfig";
import { translate } from "./LocalizationService";
import { workspaceService } from "./WorkspaceService";
import { GameChannelDefinition } from "../shared/game-channel/GameChannelDefinition";
import { gameFileOperationGuard } from "./game/GameFileOperationGuard";
import { gameReleaseService } from "./game/GameReleaseService";
import { gameSaveCoordinator } from "./game/GameSaveCoordinator";
import { publishGameState } from "./game/GameStateEvents";
import { EGameFolderOpenResult } from "../shared/EGameFolderOpenResult";
import { ipcMain, shell } from "electron";
import { Bridge } from "../shared/bridge-api/Bridge";
import { join } from "node:path";
import { GAME_BUNDLE_MANIFEST_FILE_NAME, GAME_BUNDLES_DIRECTORY_NAME } from "../shared/Const";
import { isNodeError } from "./utils/isNodeError";
import { isGameBundleManifest } from "./utils/isGameBundleManifest";
import { resolveUserdataPath } from "./utils/resolveUserdataPath";
import { broadcastInstallIPC } from "./utils/broadcastInstallIPC";
import { modDeploymentService } from "./mods/ModDeploymentService";

class GameBundleService {
    private readonly preferredWorldByGameBundleId = new Map<string, string | null>();

    async initialize(): Promise<void> {
        ipcMain.handle(Bridge.Game.installLatestGameBundle, (_, options: GameBundleInstallOptions) => {
            return gameFileOperationGuard.run("installing-bundle", () => this.installLatestGameBundleUnlocked(options));
        });

        ipcMain.handle(Bridge.Game.setActiveGameBundle, (_, gameBundleId: string) => {
            return gameFileOperationGuard.run("activating-bundle", () => this.setActiveGameBundleUnlocked(gameBundleId));
        });

        ipcMain.handle(Bridge.Game.deleteGameBundle, (_, gameBundleId: string, options: GameBundleDeleteOptions) => {
            return gameFileOperationGuard.run("deleting-bundle", () => this.deleteGameBundleUnlocked(gameBundleId, options));
        });

        ipcMain.handle(Bridge.Game.openGameBundleFolder, async (_, gameBundleId: string): Promise<EGameFolderOpenResult> => {
            const gameBundle = await this.findGameBundle(gameBundleId);
            return openFolder(gameBundle?.path ?? null);
        });

        ipcMain.handle(Bridge.Game.openSavesFolder, async (_, gameBundleId: string): Promise<EGameFolderOpenResult> => {
            const savesPath = await this.getSavesFolder(gameBundleId);
            return openFolder(savesPath);
        });
    }

    async getGameBundles(): Promise<GameBundle[]> {
        const ws = workspaceService.getReadyWorkspace();
        if (ws === null) return [];
        return (await this.readAndRepair(ws.path, ws.config, ws.selectedGameChannel.id)).gameBundles;
    }

    async getActiveGameBundle(): Promise<GameBundle | null> {
        return (await this.getGameBundles()).find((bundle) => bundle.isActive) ?? null;
    }

    getPreferredWorld(gameBundleId: string): string | null {
        return this.preferredWorldByGameBundleId.get(gameBundleId) ?? null;
    }

    setPreferredWorld(gameBundleId: string, world: string | null): void {
        this.preferredWorldByGameBundleId.set(gameBundleId, world);
    }

    async getSavesFolder(gameBundleId: string): Promise<string | null> {
        const gameBundle = await this.findGameBundle(gameBundleId);
        if (gameBundle === null) return null;
        await mkdir(gameBundle.userdataPath, { recursive: true });
        return gameBundle.userdataPath;
    }

    private async installLatestGameBundleUnlocked(options: GameBundleInstallOptions): Promise<EGameBundleInstallResult> {
        broadcastInstallIPC({ status: "resolving-release" }, true);
        const ws = workspaceService.getReadyWorkspace();
        if (ws === null) return { status: "unavailable", message: translate("game.error.workspace.not.ready") };

        let createdGameBundle: GameBundle | null = null;
        try {
            const channel = ws.selectedGameChannel;
            const releases = await gameReleaseService.fetch(channel, false);
            const release = options.releaseId === undefined ? releases[0] : releases.find((candidate) => candidate.id === options.releaseId);
            if (release === undefined) {
                broadcastInstallIPC({ status: "idle" }, true);
                return { status: "error", message: translate("game.error.no.compatible.release.asset") };
            }

            const gameBundlesBefore = await this.read(ws.path, ws.config, channel.id);
            const existingGameBundle = gameBundlesBefore.find((gameBundle) => gameBundle.id === release.id);
            if (existingGameBundle !== undefined) {
                await modDeploymentService.synchronize(ws.path, channel.id, [existingGameBundle.userdataPath]);
                if (options.makeActive) await this.setActiveGameBundleUnlocked(existingGameBundle.id);
                this.completeInstall(release.name);
                await gameSaveCoordinator.updateActiveGameBundle(await this.getActiveGameBundle());
                await publishGameState(releases[0] ?? null);
                return { status: "installed", bundle: existingGameBundle };
            }

            const gameBundle = await gameReleaseService.install(ws.path, ws.config, channel, release, options, gameBundlesBefore);
            createdGameBundle = gameBundle;
            await modDeploymentService.synchronize(ws.path, channel.id, [gameBundle.userdataPath]);
            const config = options.makeActive ? await this.activateBundle(ws.config, channel.id, gameBundle.id) : ws.config;
            if (options.removeOlderGameBundles) {
                await this.removeOlder(ws.path, config, channel.id, gameBundle.id, true);
            }
            await gameReleaseService.cleanupDownloads(ws.path, channel.id);
            this.completeInstall(release.name);
            await gameSaveCoordinator.updateActiveGameBundle(await this.getActiveGameBundle());
            await publishGameState(releases[0] ?? null);
            return { status: "installed", bundle: gameBundle };
        } catch (error) {
            if (createdGameBundle !== null) {
                await rm(createdGameBundle.path, { recursive: true, force: true }).catch((cleanupError) => {
                    console.error("[game-bundle] failed to remove incomplete game bundle", cleanupError);
                });
                await rm(createdGameBundle.userdataPath, { recursive: true, force: true }).catch((cleanupError) => {
                    console.error("[game-bundle] failed to remove incomplete userdata", cleanupError);
                });
            }

            const message = error instanceof Error ? error.message : String(error);
            console.error("[game-bundle] failed to install game bundle release", error);
            broadcastInstallIPC({ status: "error", message }, true);
            await publishGameState(await this.safeFindLatest(ws.selectedGameChannel));
            return { status: "error", message };
        }
    }

    private async read(workspacePath: string, config: WorkspaceConfig, channelId: string): Promise<GameBundle[]> {
        const channelGameBundlesPath = join(workspacePath, GAME_BUNDLES_DIRECTORY_NAME, channelId);
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
                const userdataPath = resolveUserdataPath(workspacePath, channelId, manifest);
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

    private async readAndRepair(workspacePath: string, config: WorkspaceConfig, channelId: string): Promise<{ config: WorkspaceConfig; gameBundles: GameBundle[] }> {
        const gameBundles = await this.read(workspacePath, config, channelId);
        const activeGameBundleId = config.activeGameBundleByChannel[channelId] ?? null;
        const activeGameBundleExists = activeGameBundleId !== null && gameBundles.some((gameBundle) => gameBundle.id === activeGameBundleId);
        if (activeGameBundleId === null || activeGameBundleExists) return { config, gameBundles };

        const activeGameBundleByChannel = { ...config.activeGameBundleByChannel };
        delete activeGameBundleByChannel[channelId];
        const repairedConfig = { ...config, activeGameBundleByChannel };
        await workspaceService.saveConfig(repairedConfig);
        return { config: repairedConfig, gameBundles: gameBundles.map((gameBundle) => ({ ...gameBundle, isActive: false })) };
    }

    private async removeOlder(workspacePath: string, config: WorkspaceConfig, channelId: string, keepGameBundleId: string, deleteUserdata: boolean): Promise<void> {
        const gameBundles = await this.read(workspacePath, config, channelId);
        await Promise.all(
            gameBundles
                .filter((bundle) => bundle.id !== keepGameBundleId)
                .map(async (bundle) => {
                    await rm(bundle.path, { recursive: true, force: true });
                    if (deleteUserdata) await rm(bundle.userdataPath, { recursive: true, force: true });
                })
        );
    }

    private async setActiveGameBundleUnlocked(gameBundleId: string): Promise<EGameBundleSetActiveResult> {
        const ws = workspaceService.getReadyWorkspace();
        if (ws === null) return { status: "unavailable", message: translate("game.error.workspace.not.ready") };
        const channel = ws.selectedGameChannel;
        const gameBundles = await this.read(ws.path, ws.config, channel.id);
        if (!gameBundles.some((gameBundle) => gameBundle.id === gameBundleId)) return { status: "error", message: translate("game.error.game.bundle.missing") };
        const gameBundle = gameBundles.find((candidate) => candidate.id === gameBundleId);
        if (gameBundle !== undefined) await modDeploymentService.synchronize(ws.path, channel.id, [gameBundle.userdataPath]);
        await this.activateBundle(ws.config, channel.id, gameBundleId);
        await gameSaveCoordinator.updateActiveGameBundle(await this.getActiveGameBundle());
        await publishGameState(await this.safeFindLatest(channel));
        return { status: "updated" };
    }

    private async deleteGameBundleUnlocked(gameBundleId: string, options: GameBundleDeleteOptions): Promise<EGameBundleDeleteResult> {
        const ws = workspaceService.getReadyWorkspace();
        if (ws === null) return { status: "unavailable", message: translate("game.error.workspace.not.ready") };
        const channel = ws.selectedGameChannel;
        const gameBundle = (await this.read(ws.path, ws.config, channel.id)).find((candidate) => candidate.id === gameBundleId);
        if (gameBundle === undefined) return { status: "error", message: translate("game.error.game.bundle.missing") };
        if (gameBundle.isActive) return { status: "blocked", message: translate("game.error.active.game.bundle.delete.blocked") };

        await rm(gameBundle.path, { recursive: true, force: true });
        if (options.deleteUserdata) await rm(gameBundle.userdataPath, { recursive: true, force: true });

        await publishGameState(await this.safeFindLatest(channel));
        return { status: "deleted" };
    }

    private async findGameBundle(gameBundleId: string): Promise<GameBundle | null> {
        return (await this.getGameBundles()).find((gameBundle) => gameBundle.id === gameBundleId) ?? null;
    }

    private async safeFindLatest(channel: GameChannelDefinition): Promise<GithubRelease | null> {
        try {
            return await gameReleaseService.findLatest(channel, false);
        } catch (error) {
            console.error("[game-bundle] failed to check latest release after state change", { channelId: channel.id, error });
            return null;
        }
    }

    private async activateBundle(config: WorkspaceConfig, channelId: string, gameBundleId: string): Promise<WorkspaceConfig> {
        const nextConfig = { ...config, activeGameBundleByChannel: { ...config.activeGameBundleByChannel, [channelId]: gameBundleId } };
        await workspaceService.saveConfig(nextConfig);
        return nextConfig;
    }

    private completeInstall(releaseName: string): void {
        broadcastInstallIPC({ status: "completed", releaseName }, true);
        queueMicrotask(() => broadcastInstallIPC({ status: "idle" }, true));
    }
}

async function openFolder(path: string | null): Promise<EGameFolderOpenResult> {
    if (path === null) return { status: "unavailable", message: translate("game.error.folder.unavailable") };
    const error = await shell.openPath(path);
    return error.length === 0 ? { status: "opened" } : { status: "error", message: error };
}

export const gameBundleService = new GameBundleService();
