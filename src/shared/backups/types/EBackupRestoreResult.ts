import { BackupSummary } from "./BackupSummary";

export type EBackupRestoreResult = { status: "restored"; summary: BackupSummary } | { status: "unavailable" | "blocked" | "error"; message: string };
