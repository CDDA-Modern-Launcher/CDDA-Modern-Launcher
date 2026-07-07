import { BrowserWindow } from "electron";

import { BackupProgress } from "../../shared/backups/types/BackupProgress";
import { BackupSummaryUpdate } from "../../shared/backups/types/BackupSummaryUpdate";
import { Bridge } from "../../shared/bridge-api/Bridge";
import { GameSaveActivityUpdate } from "../../shared/GameSaveActivityUpdate";
import { GameSaveSummaryUpdate } from "../../shared/GameSaveSummaryUpdate";
import { GameRuntimeState } from "../../shared/GameRuntimeState";
import { GameBundleInstallProgress } from "../../shared/game-bundle/GameBundleInstallProgress";
import { GameFileOperationState } from "../../shared/game-bundle/GameFileOperationState";
import { GameBundleState } from "../../shared/game-bundle/GameBundleState";

export class GameEvents {
    private lastInstallProgressKey = "";
    private lastInstallProgressAt = 0;
    private lastBackupProgressKey = "";
    private lastBackupProgressAt = 0;

    emitGameState(state: GameBundleState): void {
        this.send(Bridge.Game.stateChanged, state);
    }

    emitFileOperation(operation: GameFileOperationState): void {
        this.send(Bridge.Game.fileOperationChanged, operation);
    }

    emitRuntime(runtime: GameRuntimeState): void {
        this.send(Bridge.Game.runtimeChanged, runtime);
    }

    emitSaveSummary(update: GameSaveSummaryUpdate): void {
        this.send(Bridge.Game.saveSummaryChanged, update);
    }

    emitSaveActivity(update: GameSaveActivityUpdate): void {
        this.send(Bridge.Game.saveActivityChanged, update);
    }

    emitBackupSummary(update: BackupSummaryUpdate): void {
        this.send(Bridge.Game.backupSummaryChanged, update);
    }

    emitInstallProgress(progress: GameBundleInstallProgress, immediate = false): void {
        if (!immediate && this.shouldThrottleInstallProgress(progress)) return;
        this.lastInstallProgressKey = getInstallProgressKey(progress);
        this.lastInstallProgressAt = Date.now();
        this.send(Bridge.Game.gameBundleInstallProgress, progress);
    }

    emitBackupProgress(progress: BackupProgress, immediate = false): void {
        if (!immediate && this.shouldThrottleBackupProgress(progress)) return;
        this.lastBackupProgressKey = getBackupProgressKey(progress);
        this.lastBackupProgressAt = Date.now();
        this.send(Bridge.Game.gameBackupProgress, progress);
    }

    private shouldThrottleInstallProgress(progress: GameBundleInstallProgress): boolean {
        const key = getInstallProgressKey(progress);
        return key === this.lastInstallProgressKey && Date.now() - this.lastInstallProgressAt < 120;
    }

    private shouldThrottleBackupProgress(progress: BackupProgress): boolean {
        const key = getBackupProgressKey(progress);
        return key === this.lastBackupProgressKey && Date.now() - this.lastBackupProgressAt < 120;
    }

    private send(channel: string, payload: unknown): void {
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send(channel, payload);
        }
    }
}

function getInstallProgressKey(progress: GameBundleInstallProgress): string {
    if (progress.status === "downloading") {
        if (progress.percent !== null) return `${progress.status}:${progress.percent}`;
        return `${progress.status}:${Math.floor(progress.transferredBytes / 1024 / 1024)}`;
    }
    if (progress.status === "extracting") return `${progress.status}:${progress.percent}`;
    return progress.status;
}

function getBackupProgressKey(progress: BackupProgress): string {
    if (progress.status === "creating" || progress.status === "restoring") return `${progress.status}:${progress.percent ?? "unknown"}`;
    return progress.status;
}
