import { BackupInstanceInfo } from "./BackupInstanceInfo";

export type BackupSummary = {
    backups: BackupInstanceInfo[];
    latestBackup: BackupInstanceInfo | null;
};
