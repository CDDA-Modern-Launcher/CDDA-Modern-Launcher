import { GameBundleState } from "./GameBundleState";

export type EGameBundleSetActiveResult = { status: "updated"; state: GameBundleState } | { status: "unavailable" | "error"; message: string };
