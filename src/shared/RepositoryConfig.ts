import { TBackupRotationLimit } from "./backups/types/TBackupRotationLimit";
import { TAutoBackupLimit } from "./backups/types/TAutoBackupLimit";
import { TAutoBackupCooldown } from "./backups/types/TAutoBackupCooldown";
import { TReleaseAssetVariant } from "./release-asset/TReleaseAssetVariant";
import { GameChannelDefinition } from "./game-channel/GameChannelDefinition";

export type RepositoryConfig = {
    schemaVersion: 1;
    createdAt: string;
    selectedChannelId: string;
    customGameChannels: GameChannelDefinition[];
    activeInstallByChannel: Record<string, string>;
    lastSeenReleaseByChannel: Record<string, string>;
    releaseAssetVeriant: TReleaseAssetVariant;
    backupsEnabled: boolean;
    autoBackupLimit: TAutoBackupLimit;
    manualBackupRotationLimit: TBackupRotationLimit;
    autoBackupCooldown: TAutoBackupCooldown;
};
