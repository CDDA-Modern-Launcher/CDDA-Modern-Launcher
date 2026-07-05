import { GameRuntimeState } from "../GameRuntimeState";

export type EGameStopResult = { status: "stopped"; runtime: GameRuntimeState } | { status: "not-running"; runtime: GameRuntimeState } | { status: "error"; message: string; runtime: GameRuntimeState };
