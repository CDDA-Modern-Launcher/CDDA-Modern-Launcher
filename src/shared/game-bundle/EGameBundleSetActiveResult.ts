export type EGameBundleSetActiveResult = { status: "updated" } | { status: "unavailable" | "blocked" | "error"; message: string };
