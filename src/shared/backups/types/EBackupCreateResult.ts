import { BackupSummary } from "./BackupSummary";
import { BackupInstanceInfo } from "./BackupInstanceInfo";

export type EBackupCreateResult = { status: "created"; summary: BackupSummary; backup: BackupInstanceInfo } | { status: "unavailable" | "blocked" | "error"; message: string };
