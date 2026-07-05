import { TAutoBackupLimit } from "./TAutoBackupLimit";
import { TBackupRotationLimit } from "./TBackupRotationLimit";
import { TAutoBackupCooldown } from "./TAutoBackupCooldown";

export type BackupSettings = {
    backupsEnabled: boolean;
    autoBackupLimit: TAutoBackupLimit;
    manualBackupRotationLimit: TBackupRotationLimit;
    autoBackupCooldown: TAutoBackupCooldown;
};
