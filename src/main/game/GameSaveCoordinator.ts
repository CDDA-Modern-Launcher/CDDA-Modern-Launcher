import { GameSaveSummaryUpdate } from "../../shared/GameSaveSummaryUpdate";
import { GameBundle } from "../../shared/game-bundle/GameBundle";
import { toAutoBackupCooldownMs } from "../../shared/backups/toAutoBackupCooldownMs";
import { GameSaveMonitor, GameSaveSettledActivity } from "../GameSaveMonitor";
import { getAutoBackupTimerKey } from "../utils/saves/getAutoBackupTimerKey";
import { getChangedWorldFolderNames } from "../utils/saves/getChangedWorldFolderNames";
import { isAutoBackupInCooldown } from "../utils/saves/isAutoBackupInCooldown";
import { readSaveSummary } from "../utils/saves/readSaveSummary";
import { workspaceService } from "../WorkspaceService";
import { gameRuntimeService } from "./GameRuntimeService";
import { GameBackupContext } from "../GameBackupContext";
import { gameBackupService } from "../GameBackupService";
import { gameBundleService } from "../GameBundleService";
import { broadcastIPC } from "../utils/broadcastIPC";
import { Bridge } from "../../shared/bridge-api/Bridge";
import { GameSaveActivityUpdate } from "../../shared/GameSaveActivityUpdate";

export class GameSaveCoordinator {
    private activeSaveMonitor: GameSaveMonitor | null = null;
    private activeSaveMonitorGameBundleId: string | null = null;
    private readonly latestBackupAtByWorld = new Map<string, number>();

    async updateActiveGameBundle(activeGameBundle: GameBundle | null): Promise<void> {
        if (activeGameBundle === null) {
            this.stopActiveSaveMonitor();
            await gameBackupService.updateActiveGameBundle(null);
            return;
        }
        if (this.activeSaveMonitorGameBundleId === activeGameBundle.id) {
            await gameBackupService.updateActiveGameBundle(activeGameBundle);
            return;
        }
        this.stopActiveSaveMonitor();
        const gameBundleId = activeGameBundle.id;
        const monitor = new GameSaveMonitor({
            userdataPath: activeGameBundle.userdataPath,
            onActivityChanged: (stable) => this.publishSaveActivity(gameBundleId, stable),
            onSettled: (activity) => this.processSettledSaveActivity(gameBundleId, activity)
        });
        this.activeSaveMonitor = monitor;
        this.activeSaveMonitorGameBundleId = gameBundleId;
        await monitor.start();
        await gameBackupService.updateActiveGameBundle(activeGameBundle);
    }

    getSavesStable(gameBundle: GameBundle | null): boolean {
        return gameBundle === null || gameBundle.id !== this.activeSaveMonitorGameBundleId ? true : this.isActiveSaveStable();
    }

    async getBackupContext(worldName?: string): Promise<GameBackupContext | null> {
        const gameBundle = await gameBundleService.getActiveGameBundle();
        if (gameBundle === null) return null;
        const preferredWorldName = worldName?.trim();
        const saves = await readSaveSummary(gameBundle.userdataPath, preferredWorldName === undefined || preferredWorldName.length === 0 ? gameBundleService.getPreferredWorld(gameBundle.id) : preferredWorldName);
        return { gameBundle, saves, gameRunning: gameRuntimeService.getState().status === "running", savesStable: this.getSavesStable(gameBundle) };
    }

    async refreshActiveSaveSummary(): Promise<void> {
        const gameBundle = await gameBundleService.getActiveGameBundle();
        if (gameBundle === null) return;
        const saves = await readSaveSummary(gameBundle.userdataPath, gameBundleService.getPreferredWorld(gameBundle.id));
        broadcastIPC(Bridge.Game.saveSummaryChanged, { gameBundleId: gameBundle.id, saves });
    }

    touchAutoBackupCooldown(gameBundleId: string, worldFolderName: string): void {
        this.latestBackupAtByWorld.set(getAutoBackupTimerKey(gameBundleId, worldFolderName), Date.now());
    }

    private publishSaveActivity(gameBundleId: string, stable: boolean): void {
        const update: GameSaveActivityUpdate = { gameBundleId, stable };
        broadcastIPC(Bridge.Game.saveActivityChanged, update);
    }

    private stopActiveSaveMonitor(): void {
        this.activeSaveMonitor?.stop();
        this.activeSaveMonitor = null;
        this.activeSaveMonitorGameBundleId = null;
        this.latestBackupAtByWorld.clear();
    }

    private isActiveSaveStable(): boolean {
        return this.activeSaveMonitor?.isStable() ?? true;
    }

    private async processSettledSaveActivity(gameBundleId: string, activity: GameSaveSettledActivity): Promise<void> {
        console.info(`[game-save] refresh save summary gameBundleId=${gameBundleId} events=${activity.eventCount} changedPaths=${activity.changedPaths.length}`);
        const changedWorldFolderNames = getChangedWorldFolderNames(activity);
        const gameBundle = await gameBundleService.getActiveGameBundle();
        if (gameBundle?.id !== gameBundleId) return;
        const saves = await readSaveSummary(gameBundle.userdataPath, gameBundleService.getPreferredWorld(gameBundle.id));
        const update: GameSaveSummaryUpdate = { gameBundleId, saves };
        broadcastIPC(Bridge.Game.saveSummaryChanged, update);
        this.queueAutoBackupAfterSave(update, changedWorldFolderNames);
    }

    private queueAutoBackupAfterSave(update: GameSaveSummaryUpdate, changedWorldFolderNames: string[]): void {
        if (gameRuntimeService.getState().status !== "running") return;
        for (const worldFolderName of changedWorldFolderNames) {
            void this.createAutoBackupAfterSave(update, worldFolderName);
        }
    }

    private async createAutoBackupAfterSave(update: GameSaveSummaryUpdate, worldFolderName: string): Promise<void> {
        const settings = workspaceService.getWorkspaceSettings();
        if (isAutoBackupInCooldown(this.latestBackupAtByWorld.get(getAutoBackupTimerKey(update.gameBundleId, worldFolderName)) ?? null, toAutoBackupCooldownMs(settings.autoBackupCooldown))) return;
        const context = await this.getBackupContext(worldFolderName);
        if (context === null || context.gameBundle.id !== update.gameBundleId) return;
        const result = await gameBackupService.createAutoBackup(context);
        if (result.status === "created") this.touchAutoBackupCooldown(context.gameBundle.id, result.backup.worldFolderName);
    }
}

export const gameSaveCoordinator = new GameSaveCoordinator();
