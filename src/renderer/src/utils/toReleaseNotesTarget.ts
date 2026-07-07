import { GithubRelease } from "../../../shared/GithubRelease";
import { getReleaseNameDisplay } from "@renderer/utils/getReleaseNameDisplay";

import { ReleaseNotesTarget } from "@renderer/types/ReleaseNotesTarget";

export function toReleaseNotesTarget(release: GithubRelease): ReleaseNotesTarget {
    return {
        title: getReleaseNameDisplay(release.name),
        publishedAt: release.publishedAt,
        htmlUrl: release.htmlUrl,
        body: release.body
    };
}
