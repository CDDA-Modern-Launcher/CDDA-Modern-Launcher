import { GameBundle } from "../../../shared/distributive/GameBundle";
import { GithubRelease } from "../../../shared/GithubRelease";
import { getReleaseDisplayName } from "@renderer/utils/getReleaseDisplayName";
import { getReleaseNameDisplay } from "@renderer/utils/getReleaseNameDisplay";
import { formatUpdateReleaseNotes } from "@renderer/utils/formatUpdateReleaseNotes";
import { ReleaseNotesTarget } from "@renderer/types/ReleaseNotesTarget";
import { TLocalizeFn } from "@renderer/localization/useLocaleStore";

export function toUpdateReleaseNotesTarget(activeInstall: GameBundle, latestRelease: GithubRelease, updateReleases: GithubRelease[], t: TLocalizeFn): ReleaseNotesTarget {
    return {
        title: t("releaseNotes.modal.updateTitle", {
            current: getReleaseDisplayName(activeInstall),
            latest: getReleaseNameDisplay(latestRelease.name)
        }),
        body: formatUpdateReleaseNotes(updateReleases, t)
    };
}
