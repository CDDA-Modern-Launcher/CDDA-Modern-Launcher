import { Distributive } from "../../../shared/distributive/Distributive";
import { GithubRelease } from "../../../shared/GithubRelease";
import { getReleaseDisplayName } from "@renderer/utils/getReleaseDisplayName";
import { toReleaseNotesTarget } from "@renderer/utils/toReleaseNotesTarget";
import { ReleaseNotesTarget } from "@renderer/types/ReleaseNotesTarget";

export function toInstalledReleaseNotesTarget(install: Distributive, release: GithubRelease | null): ReleaseNotesTarget {
    if (release !== null) return toReleaseNotesTarget(release);
    return {
        title: getReleaseDisplayName(install),
        publishedAt: install.manifest.publishedAt,
        htmlUrl: install.manifest.htmlUrl,
        body: install.manifest.releaseBody ?? ""
    };
}
