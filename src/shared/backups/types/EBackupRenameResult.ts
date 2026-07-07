import { BackupSummary } from "./BackupSummary";
import { BackupInstanceInfo } from "./BackupInstanceInfo";

export type EBackupRenameResult = { status: "renamed"; summary: BackupSummary; backup: BackupInstanceInfo } | { status: "unavailable" | "blocked" | "error"; message: string };
