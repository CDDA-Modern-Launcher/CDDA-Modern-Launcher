import { GameBundleState } from "./GameBundleState";

export type EGameBundleDeleteResult = { status: "deleted"; state: GameBundleState } | { status: "unavailable" | "blocked" | "error"; message: string };
