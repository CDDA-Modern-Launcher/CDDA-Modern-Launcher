import { GitHubAsset } from "./GitHubAsset";
import { GameChannelDefinition } from "../../../shared/game-channel/GameChannelDefinition";
import { TReleaseAssetVariant } from "../../../shared/release-asset/TReleaseAssetVariant";
import { isCompatibleAsset } from "./isCompatibleAsset";
import { getReleaseAssetVariantFallbackOrder } from "../../../shared/release-asset/getReleaseAssetVariantFallbackOrder";
import { getAssetVariant } from "./getAssetVariant";

export function selectReleaseAsset(assets: GitHubAsset[] | undefined, channel: GameChannelDefinition, gameAssetVariant: TReleaseAssetVariant): GitHubAsset | null {
    const compatibleAssets = assets?.filter((candidate) => isCompatibleAsset(candidate, channel)) ?? [];
    const fallbackOrder = getReleaseAssetVariantFallbackOrder(gameAssetVariant);

    for (const variant of fallbackOrder) {
        const asset = compatibleAssets.find((candidate) => getAssetVariant(candidate) === variant);
        if (asset !== undefined) return asset;
    }

    return compatibleAssets[0] ?? null;
}
