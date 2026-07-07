import { GameBundleState } from "../../../shared/game-bundle/GameBundleState";
import { getErrorMessage } from "../../../shared/getErrorMessage";

export function toGameStateError(error: unknown): GameBundleState {
    return { status: "error", message: getErrorMessage(error) };
}
