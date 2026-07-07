import { GameBundleState } from "../../../shared/game-bundle/GameBundleState";

export function withSaveSummary(state: GameBundleState, saves: Extract<GameBundleState, { status: "ready" }>["saves"], gameBundleId: string): GameBundleState {
    return state.status === "ready" && state.gameBundle?.id === gameBundleId ? { ...state, saves } : state;
}
