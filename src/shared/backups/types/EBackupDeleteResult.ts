export type EBackupDeleteResult = { status: "deleted" } | { status: "unavailable" | "blocked" | "error"; message: string };
