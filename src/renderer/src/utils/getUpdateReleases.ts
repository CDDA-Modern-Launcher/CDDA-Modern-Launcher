import { GameBundle } from "../../../shared/game-bundle/GameBundle";
import { GithubRelease } from "../../../shared/GithubRelease";

export function getUpdateReleases(activeGameBundle: GameBundle, releases: GithubRelease[]): GithubRelease[] {
    if (releases.length === 0) return [];
    const activeIndex = releases.findIndex((release) => release.id === activeGameBundle.id);
    if (activeIndex >= 0) return releases.slice(0, activeIndex);

    const activePublishedAt = new Date(activeGameBundle.manifest.publishedAt).getTime();
    if (!Number.isFinite(activePublishedAt)) return releases;
    return releases.filter((release) => new Date(release.publishedAt).getTime() > activePublishedAt);
}
