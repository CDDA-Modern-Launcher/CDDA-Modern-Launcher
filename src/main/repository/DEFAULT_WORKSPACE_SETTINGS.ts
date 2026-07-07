import { SettingsIPC } from "../../shared/SettingsIPC";
import { DEFAULT_RELEASE_ASSET_VARIANT } from "../../shared/release-asset/DEFAULT_RELEASE_ASSET_VARIANT";
import { DEFAULT_BACKUP_SETTINGS } from "../../shared/backups/DEFAULT_BACKUP_SETTINGS";

export const DEFAULT_WORKSPACE_SETTINGS: SettingsIPC = {
    releaseAssetVariant: DEFAULT_RELEASE_ASSET_VARIANT,
    backupsEnabled: DEFAULT_BACKUP_SETTINGS.backupsEnabled,
    autoBackupLimit: DEFAULT_BACKUP_SETTINGS.autoBackupLimit,
    manualBackupRotationLimit: DEFAULT_BACKUP_SETTINGS.manualBackupRotationLimit,
    autoBackupCooldown: DEFAULT_BACKUP_SETTINGS.autoBackupCooldown
};
