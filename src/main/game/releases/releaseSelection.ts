import { TReleaseAssetVariant } from "../../../shared/release-asset/TReleaseAssetVariant";
import { getReleaseAssetVariantFallbackOrder } from "../../../shared/release-asset/getReleaseAssetVariantFallbackOrder";
import { GameChannelDefinition } from "../../../shared/game-channel/GameChannelDefinition";
import { GithubRelease } from "../../../shared/GithubRelease";

type GitHubReleaseDto = {
    id?: number;
    name?: string | null;
    tag_name?: string;
    published_at?: string;
    html_url?: string;
    body?: string | null;
    draft?: boolean;
    assets?: GitHubAssetDto[];
};

type GitHubAssetDto = {
    name?: string;
    size?: number;
    browser_download_url?: string;
};

export function getReleaseCacheKey(channel: GameChannelDefinition, gameAssetVariant: TReleaseAssetVariant): string {
    const platformKey = process.platform === "win32" ? "windows" : "linux";
    return `${channel.id}:${platformKey}:${gameAssetVariant}:${channel.releasesUrl}`;
}

export function withGitHubPageSize(url: string, page: number): string {
    try {
        const value = new URL(url);
        if (value.hostname === "api.github.com") {
            if (!value.searchParams.has("per_page")) value.searchParams.set("per_page", "50");
            value.searchParams.set("page", page.toString());
        }
        return value.toString();
    } catch {
        return url;
    }
}

export function matchesChannelKind(release: GithubRelease, channel: GameChannelDefinition): boolean {
    const value = `${release.id} ${release.name}`.toLowerCase();
    const isExperimentalRelease = value.includes("experimental");
    return channel.kind === "experimental" ? isExperimentalRelease : !isExperimentalRelease;
}

function toAssetNameParts(value: string | string[]): string[] {
    return Array.isArray(value) ? value : [value];
}

export function toGameRelease(value: unknown, channel: GameChannelDefinition, gameAssetVariant: TReleaseAssetVariant): GithubRelease | null {
    if (typeof value !== "object" || value === null) return null;
    const release = value as GitHubReleaseDto;
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
        asset: {
            name: asset.name,
            size: typeof asset.size === "number" ? asset.size : 0,
            downloadUrl: asset.browser_download_url
        }
    };
}

function selectReleaseAsset(assets: GitHubAssetDto[] | undefined, channel: GameChannelDefinition, gameAssetVariant: TReleaseAssetVariant): GitHubAssetDto | null {
    const compatibleAssets = assets?.filter((candidate) => isCompatibleAsset(candidate, channel)) ?? [];
    const fallbackOrder = getReleaseAssetVariantFallbackOrder(gameAssetVariant);

    for (const variant of fallbackOrder) {
        const asset = compatibleAssets.find((candidate) => getAssetVariant(candidate) === variant);
        if (asset !== undefined) return asset;
    }

    return compatibleAssets[0] ?? null;
}

function getAssetVariant(asset: GitHubAssetDto): TReleaseAssetVariant {
    const assetName = asset.name?.toLowerCase() ?? "";

    if (assetName.includes("with-graphics-and-sounds") || assetName.includes("with-sounds")) return "graphics-and-sounds";
    if (assetName.includes("with-graphics")) return "graphics";
    return "tiles";
}

function isCompatibleAsset(asset: GitHubAssetDto, channel: GameChannelDefinition): boolean {
    if (typeof asset.name !== "string" || typeof asset.browser_download_url !== "string") return false;
    const platformKey = process.platform === "win32" ? "windows" : "linux";
    const requiredNameParts = toAssetNameParts(channel.assetNameIncludes[platformKey]);
    const assetName = asset.name.toLowerCase();
    const isSupportedArchive = assetName.endsWith(".zip") || assetName.endsWith(".tar.gz") || assetName.endsWith(".tgz");
    return isSupportedArchive && requiredNameParts.some((part) => part.length > 0 && assetName.includes(part.toLowerCase()));
}
