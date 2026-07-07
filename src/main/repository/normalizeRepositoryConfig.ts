import { RepositoryConfig } from "../../shared/RepositoryConfig";
import { normalizeCustomChannel } from "./normalizeCustomChannel";
import { getEffectiveGameChannels } from "../../shared/game-channel/getEffectiveGameChannels";
import { DEFAULT_GAME_CHANNEL_ID } from "../../shared/Const";
import { normalizeStringRecord } from "../utils/normalizeStringRecord";
import { isReleaseAssetVariant } from "../../shared/release-asset/isReleaseAssetVariant";
import { DEFAULT_RELEASE_ASSET_VARIANT } from "../../shared/release-asset/DEFAULT_RELEASE_ASSET_VARIANT";
import { DEFAULT_BACKUP_SETTINGS } from "../../shared/backups/DEFAULT_BACKUP_SETTINGS";
import { isAutoBackupLimit } from "../../shared/backups/isAutoBackupLimit";
import { isBackupRotationLimit } from "../../shared/backups/isBackupRotationLimit";
import { isAutoBackupCooldown } from "../../shared/backups/isAutoBackupCooldown";

export function normalizeRepositoryConfig(config: Partial<RepositoryConfig>): RepositoryConfig {
    const customChannels = Array.isArray(config.customGameChannels) ? config.customGameChannels.map(normalizeCustomChannel).filter((channel) => channel !== null) : [];
    const channels = getEffectiveGameChannels(customChannels);
    const selectedChannelId = typeof config.selectedChannelId === "string" && channels.some((channel) => channel.id === config.selectedChannelId) ? config.selectedChannelId : DEFAULT_GAME_CHANNEL_ID;

    return {
        schemaVersion: 1,
        selectedChannelId,
        customGameChannels: customChannels,
        activeGameBundleByChannel: normalizeStringRecord(config.activeGameBundleByChannel),
        releaseAssetVariant: isReleaseAssetVariant(config.releaseAssetVariant) ? config.releaseAssetVariant : DEFAULT_RELEASE_ASSET_VARIANT,
        backupsEnabled: typeof config.backupsEnabled === "boolean" ? config.backupsEnabled : DEFAULT_BACKUP_SETTINGS.backupsEnabled,
        autoBackupLimit: isAutoBackupLimit(config.autoBackupLimit) ? config.autoBackupLimit : DEFAULT_BACKUP_SETTINGS.autoBackupLimit,
        manualBackupRotationLimit: isBackupRotationLimit(config.manualBackupRotationLimit) ? config.manualBackupRotationLimit : DEFAULT_BACKUP_SETTINGS.manualBackupRotationLimit,
        autoBackupCooldown: isAutoBackupCooldown(config.autoBackupCooldown) ? config.autoBackupCooldown : DEFAULT_BACKUP_SETTINGS.autoBackupCooldown
    };
}
