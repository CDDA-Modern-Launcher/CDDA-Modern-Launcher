import { BackupSettings } from "./types/BackupSettings";

export const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
    backupsEnabled: true,
    autoBackupLimit: "5",
    manualBackupRotationLimit: "disabled",
    autoBackupCooldown: "15s"
};
