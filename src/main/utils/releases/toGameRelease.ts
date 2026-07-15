import { GameChannelDefinition } from "../../../shared/game-channel/GameChannelDefinition";
import { TReleaseAssetVariant } from "../../../shared/release-asset/TReleaseAssetVariant";
import { GithubRelease } from "../../../shared/GithubRelease";
import { GitHubRelease } from "./GitHubRelease";
import { selectReleaseAsset } from "./selectReleaseAsset";

export function toGameRelease(value: unknown, channel: GameChannelDefinition, gameAssetVariant: TReleaseAssetVariant): GithubRelease | null {
    if (typeof value !== "object" || value === null) return null;
    const release = value as GitHubRelease;
    if (release.draft === true || typeof release.tag_name !== "string" || typeof release.published_at !== "string") return null;
    const asset = selectReleaseAsset(release.assets, channel, gameAssetVariant);
    if (asset?.name === undefined || asset.browser_download_url === undefined) return null;
    return {
        id: release.tag_name,
        name: release.name ?? release.tag_name,
        tagName: release.tag_name,
        publishedAt: release.published_at,
        htmlUrl: release.html_url ?? `https://github.com/${channel.githubOwner}/${channel.githubRepo}/releases/tag/${encodeURIComponent(release.tag_name)}`,
        body: release.body ?? "",
        prerelease: release.prerelease === true,
        asset: {
            name: asset.name,
            size: typeof asset.size === "number" ? asset.size : 0,
            downloadUrl: asset.browser_download_url
        }
    };
}
