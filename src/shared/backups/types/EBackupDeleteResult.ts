import { BackupSummary } from "./BackupSummary";

export type EBackupDeleteResult = { status: "deleted"; summary: BackupSummary } | { status: "unavailable" | "error"; message: string };
