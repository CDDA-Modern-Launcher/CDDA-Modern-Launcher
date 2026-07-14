import { TBackupRotationLimit } from "./backups/types/TBackupRotationLimit";
import { TAutoBackupLimit } from "./backups/types/TAutoBackupLimit";
import { TAutoBackupCooldown } from "./backups/types/TAutoBackupCooldown";
import { TReleaseAssetVariant } from "./release-asset/TReleaseAssetVariant";
import { GameChannelDefinition } from "./game-channel/GameChannelDefinition";

export type WorkspaceConfig = {
    schemaVersion: 1;
    selectedChannelId: string;
    customGameChannels: GameChannelDefinition[];
    activeGameBundleByChannel: Record<string, string>;
    releaseAssetVariant: TReleaseAssetVariant;
    backupsEnabled: boolean;
    autoBackupLimit: TAutoBackupLimit;
    manualBackupRotationLimit: TBackupRotationLimit;
    autoBackupCooldown: TAutoBackupCooldown;
};
