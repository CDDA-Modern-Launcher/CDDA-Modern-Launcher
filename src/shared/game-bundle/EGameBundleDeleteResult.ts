export type EGameBundleDeleteResult = { status: "deleted" } | { status: "unavailable" | "blocked" | "error"; message: string };
