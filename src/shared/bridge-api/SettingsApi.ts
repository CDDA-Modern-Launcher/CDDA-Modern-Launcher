import { TBackupRotationLimit } from "../backups/types/TBackupRotationLimit";
import { TAutoBackupLimit } from "../backups/types/TAutoBackupLimit";
import { TAutoBackupCooldown } from "../backups/types/TAutoBackupCooldown";
import { TReleaseAssetVariant } from "../release-asset/TReleaseAssetVariant";
import { SettingsIPC } from "../SettingsIPC";

export type SettingsApi = {
    get: () => Promise<SettingsIPC>;
    setGameAssetVariant: (gameAssetVariant: TReleaseAssetVariant) => Promise<SettingsIPC>;
    setBackupsEnabled: (backupsEnabled: boolean) => Promise<SettingsIPC>;
    setAutoBackupLimit: (autoBackupLimit: TAutoBackupLimit) => Promise<SettingsIPC>;
    setAutoBackupCooldown: (autoBackupCooldown: TAutoBackupCooldown) => Promise<SettingsIPC>;
    setManualBackupRotationLimit: (manualBackupRotationLimit: TBackupRotationLimit) => Promise<SettingsIPC>;
    onChanged: (callback: (settings: SettingsIPC) => void) => () => void;
};
