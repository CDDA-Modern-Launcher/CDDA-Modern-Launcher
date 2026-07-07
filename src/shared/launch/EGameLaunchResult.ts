export type EGameLaunchResult = { status: "launched" } | { status: "already-running" } | { status: "unavailable" | "blocked"; message: string };
