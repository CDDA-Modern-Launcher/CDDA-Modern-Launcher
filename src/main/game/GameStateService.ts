import { ipcMain } from "electron";

import { Bridge } from "../../shared/bridge-api/Bridge";
import { GameStateRequest } from "../../shared/bridge-api/types/GameStateRequest";
import { GithubRelease } from "../../shared/GithubRelease";
import { GameBundleState } from "../../shared/game-bundle/GameBundleState";
import { translate } from "../LocalizationService";
import { gameBackupService } from "../GameBackupService";
import { gameBundleService } from "../GameBundleService";
import { workspaceService } from "../WorkspaceService";
import { broadcastIPC } from "../utils/broadcastIPC";
import { readSaveSummary } from "../utils/saves/readSaveSummary";
import { gameReleaseService } from "./GameReleaseService";
import { gameSaveCoordinator } from "./GameSaveCoordinator";
import { registerActiveBundleSynchronizer, registerGameStatePublisher } from "./GameStateEvents";

class GameStateService {
    async initialize(): Promise<void> {
        registerGameStatePublisher((latestRelease) => this.publish(latestRelease));
        registerActiveBundleSynchronizer(() => this.synchronizeActiveBundle());

        ipcMain.handle(Bridge.Game.getState, (_, request: GameStateRequest) => {
            const refreshLatest = typeof request === "boolean" ? request : request?.refreshLatest === true;
            const forceRefresh = typeof request === "object" && request?.forceRefresh === true;
            return this.getState(refreshLatest, forceRefresh);
        });

        ipcMain.handle(Bridge.Game.getReleases, (_, forceRefresh: boolean | undefined) => {
            const ws = workspaceService.getReadyWorkspace();
            return ws === null ? [] : gameReleaseService.fetch(ws.selectedGameChannel, forceRefresh === true);
        });

        await this.synchronizeActiveBundle();
    }

    async synchronizeActiveBundle(): Promise<void> {
        await gameSaveCoordinator.updateActiveGameBundle(await gameBundleService.getActiveGameBundle());
    }

    async getState(refreshLatest = false, forceRefresh = false): Promise<GameBundleState> {
        const ws = workspaceService.getReadyWorkspace();
        if (ws === null) return { status: "unavailable", message: translate("game.error.repository.not.ready") };

        const gameBundles = await gameBundleService.getGameBundles();
        const activeGameBundle = gameBundles.find((bundle) => bundle.isActive) ?? null;
        const latest = await this.readLatestRelease(refreshLatest, forceRefresh);

        return {
            status: "ready",
            workspacePath: ws.path,
            channel: ws.selectedGameChannel,
            gameBundle: activeGameBundle,
            gameBundles,
            latestRelease: latest.release,
            latestReleaseError: latest.error,
            updateAvailable: latest.release !== null && activeGameBundle !== null && latest.release.id !== activeGameBundle.id,
            saves: activeGameBundle === null ? null : await readSaveSummary(activeGameBundle.userdataPath, gameBundleService.getPreferredWorld(activeGameBundle.id)),
            backups: await gameBackupService.getSummary(activeGameBundle),
            savesStable: gameSaveCoordinator.getSavesStable(activeGameBundle)
        };
    }

    private async publish(latestRelease?: GithubRelease | null): Promise<void> {
        const state = await this.getState(false);
        const nextState =
            state.status !== "ready" || latestRelease === undefined
                ? state
                : {
                      ...state,
                      latestRelease,
                      latestReleaseError: null,
                      updateAvailable: latestRelease !== null && state.gameBundle !== null && latestRelease.id !== state.gameBundle.id
                  };
        broadcastIPC(Bridge.Game.stateChanged, nextState);
    }

    private async readLatestRelease(refreshLatest: boolean, forceRefresh: boolean): Promise<{ release: GithubRelease | null; error: string | null }> {
        if (!refreshLatest) return { release: null, error: null };
        const ws = workspaceService.getReadyWorkspace();
        if (ws === null) return { release: null, error: null };
        try {
            return { release: await gameReleaseService.findLatest(ws.selectedGameChannel, forceRefresh), error: null };
        } catch (error) {
            console.error("[game-state] failed to check latest release", { channelId: ws.selectedGameChannel.id, error });
            return { release: null, error: error instanceof Error ? error.message : String(error) };
        }
    }
}

export const gameStateService = new GameStateService();
