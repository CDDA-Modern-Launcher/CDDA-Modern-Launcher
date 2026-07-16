import { GameBundle } from "./GameBundle";

export type EGameBundleInstallResult = { status: "installed"; bundle: GameBundle } | { status: "unavailable" | "blocked" | "cancelled" | "error"; message: string };
