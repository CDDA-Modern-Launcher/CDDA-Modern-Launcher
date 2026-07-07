import { Distributive } from "../../../shared/distributive/Distributive";
import { GithubRelease } from "../../../shared/GithubRelease";
import { getReleaseDisplayName } from "@renderer/utils/getReleaseDisplayName";
import { getReleaseNameDisplay } from "@renderer/utils/getReleaseNameDisplay";
import { formatUpdateReleaseNotes } from "@renderer/utils/formatUpdateReleaseNotes";
import { Translate } from "@renderer/components/home/homeUtils";
import { ReleaseNotesTarget } from "@renderer/types/ReleaseNotesTarget";

export function toUpdateReleaseNotesTarget(activeInstall: Distributive, latestRelease: GithubRelease, updateReleases: GithubRelease[], t: Translate): ReleaseNotesTarget {
    return {
        title: t("releaseNotes.modal.updateTitle", {
            current: getReleaseDisplayName(activeInstall),
            latest: getReleaseNameDisplay(latestRelease.name)
        }),
        body: formatUpdateReleaseNotes(updateReleases, t)
    };
}
