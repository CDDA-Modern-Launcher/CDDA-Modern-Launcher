import { GameBundleState } from "../../../shared/game-bundle/GameBundleState";

export function withSaveActivity(state: GameBundleState, savesStable: boolean, gameBundleId: string): GameBundleState {
    return state.status === "ready" && state.gameBundle?.id === gameBundleId ? { ...state, savesStable } : state;
}
