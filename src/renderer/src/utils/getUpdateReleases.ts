import { Distributive } from "../../../shared/distributive/Distributive";
import { GithubRelease } from "../../../shared/GithubRelease";

export function getUpdateReleases(activeInstall: Distributive, releases: GithubRelease[]): GithubRelease[] {
    if (releases.length === 0) return [];
    const activeIndex = releases.findIndex((release) => release.id === activeInstall.id);
    if (activeIndex >= 0) return releases.slice(0, activeIndex);

    const activePublishedAt = new Date(activeInstall.manifest.publishedAt).getTime();
    if (!Number.isFinite(activePublishedAt)) return releases;
    return releases.filter((release) => new Date(release.publishedAt).getTime() > activePublishedAt);
}
