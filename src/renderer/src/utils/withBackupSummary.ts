import { GameBundleState } from "../../../shared/game-bundle/GameBundleState";
import { BackupSummary } from "../../../shared/backups/types/BackupSummary";

export function withBackupSummary(state: GameBundleState, summary: BackupSummary, gameBundleId: string): GameBundleState {
    return state.status === "ready" && state.gameBundle?.id === gameBundleId ? { ...state, backups: summary } : state;
}
