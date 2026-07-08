import { GithubRelease } from "../../../shared/GithubRelease";
import { getReleaseNameDisplay } from "@renderer/utils/getReleaseNameDisplay";
import { formatDate } from "@renderer/utils/formatDate";
import { TLocalizeFn } from "@renderer/stores/useLocaleStore";

export function formatUpdateReleaseNotes(releases: GithubRelease[], t: TLocalizeFn): string {
    if (releases.length === 0) return t("release.notes.modal.empty.update.range");
    return releases
        .map((release) => {
            const body = release.body.trim() || t("release.notes.modal.empty");
            return [`## ${getReleaseNameDisplay(release.name)}`, t("release.notes.modal.published.at", { date: formatDate(release.publishedAt) }), "", body].join("\n");
        })
        .join("\n\n────────────────────────\n\n");
}
