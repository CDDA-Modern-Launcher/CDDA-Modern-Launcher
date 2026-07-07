import { GameBundle } from "./GameBundle";

export type EGameBundleInstallResult = { status: "installed"; bundle: GameBundle } | { status: "unavailable" | "blocked" | "error"; message: string };
