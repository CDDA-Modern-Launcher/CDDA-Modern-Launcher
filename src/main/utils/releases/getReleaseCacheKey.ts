import { GameChannelDefinition } from "../../../shared/game-channel/GameChannelDefinition";
import { TReleaseAssetVariant } from "../../../shared/release-asset/TReleaseAssetVariant";

export function getReleaseCacheKey(channel: GameChannelDefinition, gameAssetVariant: TReleaseAssetVariant): string {
    const platformKey = process.platform === "win32" ? "windows" : "linux";
    return `${channel.id}:${platformKey}:${gameAssetVariant}:${channel.releasesUrl}`;
}
