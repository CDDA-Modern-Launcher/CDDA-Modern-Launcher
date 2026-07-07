import { BackupInstanceInfo } from "./BackupInstanceInfo";

export type EBackupCreateResult = { status: "created"; backup: BackupInstanceInfo } | { status: "unavailable" | "blocked" | "error"; message: string };
