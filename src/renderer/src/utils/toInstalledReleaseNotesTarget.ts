import { GameBundle } from "../../../shared/game-bundle/GameBundle";
import { GithubRelease } from "../../../shared/GithubRelease";
import { getReleaseDisplayName } from "@renderer/utils/getReleaseDisplayName";
import { toReleaseNotesTarget } from "@renderer/utils/toReleaseNotesTarget";
import { ReleaseNotesTarget } from "@renderer/types/ReleaseNotesTarget";

export function toInstalledReleaseNotesTarget(gameBundle: GameBundle, release: GithubRelease | null): ReleaseNotesTarget {
    if (release !== null) return toReleaseNotesTarget(release);
    return {
        title: getReleaseDisplayName(gameBundle),
        publishedAt: gameBundle.manifest.publishedAt,
        htmlUrl: gameBundle.manifest.htmlUrl,
        body: ""
    };
}
