import { GameRuntimeState } from "../GameRuntimeState";

export type EGameLaunchResult = { status: "launched"; runtime: GameRuntimeState } | { status: "already-running"; runtime: GameRuntimeState } | { status: "unavailable" | "blocked"; message: string };
