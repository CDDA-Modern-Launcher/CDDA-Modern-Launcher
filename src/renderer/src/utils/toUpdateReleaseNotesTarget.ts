import { GameBundle } from "../../../shared/game-bundle/GameBundle";
import { GithubRelease } from "../../../shared/GithubRelease";
import { getReleaseDisplayName } from "@renderer/utils/getReleaseDisplayName";
import { getReleaseNameDisplay } from "@renderer/utils/getReleaseNameDisplay";
import { formatUpdateReleaseNotes } from "@renderer/utils/formatUpdateReleaseNotes";
import { ReleaseNotesTarget } from "@renderer/types/ReleaseNotesTarget";
import { TLocalizeFn } from "@renderer/stores/useLocaleStore";

export function toUpdateReleaseNotesTarget(activeGameBundle: GameBundle, latestRelease: GithubRelease, updateReleases: GithubRelease[], t: TLocalizeFn): ReleaseNotesTarget {
    return {
        title: t("release.notes.modal.update.title", {
            current: getReleaseDisplayName(activeGameBundle),
            latest: getReleaseNameDisplay(latestRelease.name)
        }),
        body: formatUpdateReleaseNotes(updateReleases)
    };
}
