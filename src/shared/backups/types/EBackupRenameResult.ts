import { BackupInstanceInfo } from "./BackupInstanceInfo";

export type EBackupRenameResult = { status: "renamed"; backup: BackupInstanceInfo } | { status: "unavailable" | "blocked" | "error"; message: string };
