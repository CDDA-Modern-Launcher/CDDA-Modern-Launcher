import { GitHubAsset } from "./GitHubAsset";
import { TReleaseAssetVariant } from "../../../shared/release-asset/TReleaseAssetVariant";

export function getAssetVariant(asset: GitHubAsset): TReleaseAssetVariant {
    const assetName = asset.name?.toLowerCase() ?? "";
    if (assetName.includes("with-graphics-and-sounds") || assetName.includes("with-sounds")) return "graphics-and-sounds";
    if (assetName.includes("with-graphics") || assetName.includes("no-soundpack")) return "graphics";
    if (assetName.includes("-tiles-")) return "graphics-and-sounds";
    return "tiles";
}
