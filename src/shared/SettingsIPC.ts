import { TReleaseAssetVariant } from "./release-asset/TReleaseAssetVariant";
import { TAutoBackupLimit } from "./backups/types/TAutoBackupLimit";
import { TBackupRotationLimit } from "./backups/types/TBackupRotationLimit";
import { TAutoBackupCooldown } from "./backups/types/TAutoBackupCooldown";

export type SettingsIPC = {
    releaseAssetVariant: TReleaseAssetVariant;
    backupsEnabled: boolean;
    autoBackupLimit: TAutoBackupLimit;
    manualBackupRotationLimit: TBackupRotationLimit;
    autoBackupCooldown: TAutoBackupCooldown;
};
