import { GameSaveSummaryUpdate } from "../../shared/GameSaveSummaryUpdate";
import { GameRuntimeState } from "../../shared/GameRuntimeState";
import { GameBundle } from "../../shared/game-bundle/GameBundle";
import { GameBundleState } from "../../shared/game-bundle/GameBundleState";
import { toAutoBackupCooldownMs } from "../../shared/backups/toAutoBackupCooldownMs";
import { GameBackupContext, GameBackupService } from "../GameBackupService";
import { GameSaveMonitor, GameSaveSettledActivity } from "../GameSaveMonitor";
import { getAutoBackupTimerKey } from "../utils/saves/getAutoBackupTimerKey";
import { getChangedWorldFolderNames } from "../utils/saves/getChangedWorldFolderNames";
import { isAutoBackupInCooldown } from "../utils/saves/isAutoBackupInCooldown";
import { readSaveSummary } from "../utils/saves/readSaveSummary";
import { GameEvents } from "./GameEvents";
import { workspaceService } from "../WorkspaceService";

export class GameSaveCoordinator {
    private activeSaveMonitor: GameSaveMonitor | null = null;
    private activeSaveMonitorGameBundleId: string | null = null;
    private readonly latestBackupAtByWorld = new Map<string, number>();

    constructor(
        private readonly backups: GameBackupService,
        private readonly events: GameEvents,
        private readonly getGameState: () => Promise<GameBundleState>,
        private readonly getRuntimeState: () => GameRuntimeState
    ) {}

    async updateActiveGameBundle(activeGameBundle: GameBundle | null): Promise<void> {
        if (activeGameBundle === null) {
            this.stopActiveSaveMonitor();
            await this.backups.updateActiveGameBundle(null);
            return;
        }
        if (this.activeSaveMonitorGameBundleId === activeGameBundle.id) {
            await this.backups.updateActiveGameBundle(activeGameBundle);
            return;
        }
        this.stopActiveSaveMonitor();
        const gameBundleId = activeGameBundle.id;
        const monitor = new GameSaveMonitor({ gameBundleId, userdataPath: activeGameBundle.userdataPath, onSettled: (activity) => this.processSettledSaveActivity(gameBundleId, activity) });
        this.activeSaveMonitor = monitor;
        this.activeSaveMonitorGameBundleId = gameBundleId;
        await monitor.start();
        await this.backups.updateActiveGameBundle(activeGameBundle);
    }

    getSavesStable(gameBundle: GameBundle | null): boolean {
        return gameBundle === null || gameBundle.id !== this.activeSaveMonitorGameBundleId ? true : this.isActiveSaveStable();
    }

    async getBackupContext(worldName?: string): Promise<GameBackupContext | null> {
        const state = await this.getGameState();
        if (state.status !== "ready" || state.gameBundle === null) return null;
        const preferredWorldName = worldName?.trim();
        const saves = preferredWorldName === undefined || preferredWorldName.length === 0 ? state.saves : await readSaveSummary(state.gameBundle.userdataPath, preferredWorldName);
        return { gameBundle: state.gameBundle, saves, gameRunning: this.getRuntimeState().status === "running", savesStable: this.getSavesStable(state.gameBundle) };
    }

    touchAutoBackupCooldown(gameBundleId: string, worldFolderName: string): void {
        this.latestBackupAtByWorld.set(getAutoBackupTimerKey(gameBundleId, worldFolderName), Date.now());
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
        const state = await this.getGameState();
        if (state.status !== "ready" || state.gameBundle?.id !== gameBundleId || state.saves === null) return;
        const update: GameSaveSummaryUpdate = { gameBundleId, saves: state.saves };
        this.events.emitSaveSummary(update);
        this.queueAutoBackupAfterSave(update, changedWorldFolderNames);
    }

    private queueAutoBackupAfterSave(update: GameSaveSummaryUpdate, changedWorldFolderNames: string[]): void {
        if (this.getRuntimeState().status !== "running") return;
        for (const worldFolderName of changedWorldFolderNames) {
            void this.createAutoBackupAfterSave(update, worldFolderName);
        }
    }

    private async createAutoBackupAfterSave(update: GameSaveSummaryUpdate, worldFolderName: string): Promise<void> {
        const settings = workspaceService.getWorkspaceSettings();
        if (isAutoBackupInCooldown(this.latestBackupAtByWorld.get(getAutoBackupTimerKey(update.gameBundleId, worldFolderName)) ?? null, toAutoBackupCooldownMs(settings.autoBackupCooldown))) return;
        const context = await this.getBackupContext(worldFolderName);
        if (context === null || context.gameBundle.id !== update.gameBundleId) return;
        const result = await this.backups.createAutoBackup(context);
        if (result.status === "created") this.touchAutoBackupCooldown(context.gameBundle.id, result.backup.worldFolderName);
    }
}
