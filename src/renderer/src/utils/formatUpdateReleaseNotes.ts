import { GithubRelease } from "../../../shared/GithubRelease";
import { getReleaseNameDisplay } from "@renderer/utils/getReleaseNameDisplay";
import { formatDate } from "@renderer/utils/formatDate";

export function formatUpdateReleaseNotes(releases: GithubRelease[]): string {
    if (releases.length === 0) return "No releases found in this range.";
    return releases
        .map((release) => {
            const body = release.body.trim() || "No release notes.";
            return [`## ${getReleaseNameDisplay(release.name)}`, `Published: ${formatDate(release.publishedAt)}`, "", body].join("\n");
        })
        .join("\n\n────────────────────────\n\n");
}
