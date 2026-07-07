export type EGameStopResult = { status: "stopped" } | { status: "not-running" } | { status: "error"; message: string };
