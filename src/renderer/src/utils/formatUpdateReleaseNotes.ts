import { GithubRelease } from "../../../shared/GithubRelease";
import { getReleaseNameDisplay } from "@renderer/utils/getReleaseNameDisplay";
import { formatDate } from "@renderer/utils/formatDate";
import { Translate } from "@renderer/components/home/homeUtils";

export function formatUpdateReleaseNotes(releases: GithubRelease[], t: Translate): string {
    if (releases.length === 0) return t("releaseNotes.modal.emptyUpdateRange");
    return releases
        .map((release) => {
            const body = release.body.trim() || t("releaseNotes.modal.empty");
            return [`## ${getReleaseNameDisplay(release.name)}`, t("releaseNotes.modal.publishedAt", { date: formatDate(release.publishedAt) }), "", body].join("\n");
        })
        .join("\n\n────────────────────────\n\n");
}
