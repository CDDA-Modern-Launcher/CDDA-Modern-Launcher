import { GitHubAsset } from "./GitHubAsset";
import { GameChannelDefinition } from "../../../shared/game-channel/GameChannelDefinition";
import { toAssetNameParts } from "./toAssetNameParts";

export function isCompatibleAsset(asset: GitHubAsset, channel: GameChannelDefinition): boolean {
    if (typeof asset.name !== "string" || typeof asset.browser_download_url !== "string") return false;
    const platformKey = process.platform === "win32" ? "windows" : "linux";
    const requiredNameParts = toAssetNameParts(channel.assetNameIncludes[platformKey]);
    const assetName = asset.name.toLowerCase();
    const isSupportedArchive = assetName.endsWith(".zip") || assetName.endsWith(".tar.gz") || assetName.endsWith(".tgz");
    return isSupportedArchive && requiredNameParts.some((part) => part.length > 0 && assetName.includes(part.toLowerCase()));
}
