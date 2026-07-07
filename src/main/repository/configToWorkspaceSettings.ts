import { RepositoryConfig } from "../../shared/RepositoryConfig";
import { SettingsIPC } from "../../shared/SettingsIPC";

export function configToWorkspaceSettings(config: RepositoryConfig): SettingsIPC {
    return {
        releaseAssetVariant: config.releaseAssetVariant,
        backupsEnabled: config.backupsEnabled,
        autoBackupLimit: config.autoBackupLimit,
        manualBackupRotationLimit: config.manualBackupRotationLimit,
        autoBackupCooldown: config.autoBackupCooldown
    };
}
