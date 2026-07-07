import { GameBundleState } from "./GameBundleState";
import { GameBundle } from "./GameBundle";

export type EGameBundleInstallResult = { status: "installed"; state: GameBundleState; bundle: GameBundle } | { status: "unavailable" | "error"; message: string };
