import { BackupSummary } from "../../../shared/backups/types/BackupSummary";
import { GameBundleState } from "../../../shared/game-bundle/GameBundleState";
import { GameRuntimeState } from "../../../shared/GameRuntimeState";
import { getErrorMessage } from "../../../shared/getErrorMessage";
import type { GameBundleStoreState } from "./useGameBundleStore";

export const EMPTY_BACKUP_SUMMARY: BackupSummary = { backups: [], latestBackup: null };

type StorePatch = Partial<GameBundleStoreState> | ((current: GameBundleStoreState) => Partial<GameBundleStoreState>);
type StoreSet = (patch: StorePatch) => void;
type StoreGet = () => GameBundleStoreState;

export function applyGameState(set: StoreSet, nextState: GameBundleState): void {
    const patch: Partial<GameBundleStoreState> = {
        state: nextState,
        backupSummary: nextState.status === "ready" ? nextState.backups : EMPTY_BACKUP_SUMMARY
    };

    if (nextState.status !== "ready" || !nextState.updateAvailable) {
        patch.releases = [];
    }

    set(patch);
}

export function toErrorState(error: unknown): GameBundleState {
    return { status: "error", message: getErrorMessage(error) };
}

export function setResultError(set: StoreSet, message: string): void {
    set({ state: { status: "error", message } });
}

export function isFileOperationBlocked(get: StoreGet): boolean {
    return get().isFileOperationRunning;
}

export function createGameBundleSubscriptions(set: StoreSet, get: StoreGet): () => void {
    void window.api.game
        .getFileOperation()
        .then((fileOperation) => set({ fileOperation, isFileOperationRunning: fileOperation.status === "running" }))
        .catch((error) => console.error("Failed to read game file operation", error));

    const unsubscribeFileOperation = window.api.game.onFileOperationChanged((fileOperation) => set({ fileOperation, isFileOperationRunning: fileOperation.status === "running" }));
    const unsubscribeInstallProgress = window.api.game.onGameBundleInstallProgress((installProgress) => set({ installProgress }));
    const unsubscribeBackupProgress = window.api.game.onBackupProgress((backupProgress) => set({ backupProgress }));
    const unsubscribeBackups = window.api.game.onBackupSummaryChanged((update) => {
        set((current) => ({
            backupSummary: update.summary,
            state: current.state.status === "ready" && current.state.gameBundle?.id === update.gameBundleId ? { ...current.state, backups: update.summary } : current.state
        }));
    });
    const unsubscribeSaves = window.api.game.onSaveSummaryChanged((update) => {
        set((current) => ({
            state: current.state.status === "ready" && current.state.gameBundle?.id === update.gameBundleId ? { ...current.state, saves: update.saves } : current.state
        }));
    });
    const unsubscribeSaveActivity = window.api.game.onSaveActivityChanged((update) => {
        set((current) => ({
            state: current.state.status === "ready" && current.state.gameBundle?.id === update.gameBundleId ? { ...current.state, savesStable: update.stable } : current.state
        }));
    });
    let previousRuntimeState: GameRuntimeState = { status: "idle" };
    const unsubscribeRuntime = window.api.game.onRuntimeChanged((runtimeState) => {
        get().setRuntimeState(runtimeState);
        if (previousRuntimeState.status === "running" && runtimeState.status === "idle") {
            void get().refresh(false);
        }
        previousRuntimeState = runtimeState;
    });

    return function cleanup() {
        unsubscribeRuntime();
        unsubscribeFileOperation();
        unsubscribeInstallProgress();
        unsubscribeBackupProgress();
        unsubscribeBackups();
        unsubscribeSaves();
        unsubscribeSaveActivity();
    };
}
