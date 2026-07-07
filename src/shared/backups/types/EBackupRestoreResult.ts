export type EBackupRestoreResult = { status: "restored" } | { status: "unavailable" | "blocked" | "error"; message: string };
