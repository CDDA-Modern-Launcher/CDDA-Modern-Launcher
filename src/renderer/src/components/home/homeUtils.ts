import { GithubRelease } from "../../../../shared/GithubRelease";
import { Distributive } from "../../../../shared/distributive/Distributive";
import { InstallDistributiveProgress } from "../../../../shared/distributive/InstallDistributiveProgress";

export type Translate = (key: string, values?: Record<string, string | number>) => string;

export type ReleaseNotesTarget = {
    title: string;
    publishedAt?: string;
    htmlUrl?: string;
    body: string;
};

export function getUpdateReleases(activeInstall: Distributive, releases: GithubRelease[]): GithubRelease[] {
    if (releases.length === 0) return [];
    const activeIndex = releases.findIndex((release) => release.id === activeInstall.id);
    if (activeIndex >= 0) return releases.slice(0, activeIndex);

    const activePublishedAt = new Date(activeInstall.manifest.publishedAt).getTime();
    if (!Number.isFinite(activePublishedAt)) return releases;
    return releases.filter((release) => new Date(release.publishedAt).getTime() > activePublishedAt);
}

export function toUpdateReleaseNotesTarget(activeInstall: Distributive, latestRelease: GithubRelease, updateReleases: GithubRelease[], t: Translate): ReleaseNotesTarget {
    return {
        title: t("releaseNotes.modal.updateTitle", {
            current: getReleaseDisplayName(activeInstall),
            latest: getReleaseNameDisplay(latestRelease.name)
        }),
        body: formatUpdateReleaseNotes(updateReleases, t)
    };
}

export function formatUpdateReleaseNotes(releases: GithubRelease[], t: Translate): string {
    if (releases.length === 0) return t("releaseNotes.modal.emptyUpdateRange");
    return releases
        .map((release) => {
            const body = release.body.trim() || t("releaseNotes.modal.empty");
            return [`## ${getReleaseNameDisplay(release.name)}`, t("releaseNotes.modal.publishedAt", { date: formatDate(release.publishedAt) }), "", body].join("\n");
        })
        .join("\n\n────────────────────────\n\n");
}

export function toReleaseNotesTarget(release: GithubRelease): ReleaseNotesTarget {
    return {
        title: getReleaseNameDisplay(release.name),
        publishedAt: release.publishedAt,
        htmlUrl: release.htmlUrl,
        body: release.body
    };
}

export function toInstalledReleaseNotesTarget(install: Distributive, release: GithubRelease | null): ReleaseNotesTarget {
    if (release !== null) return toReleaseNotesTarget(release);
    return {
        title: getReleaseDisplayName(install),
        publishedAt: install.manifest.publishedAt,
        htmlUrl: install.manifest.htmlUrl,
        body: install.manifest.releaseBody ?? ""
    };
}

export function getUpdateAction(updateAvailable: boolean, latestRelease: GithubRelease | null, latestInstalledId: string | null): "install" | "activate" | null {
    if (!updateAvailable || latestRelease === null) return null;
    return latestInstalledId === null ? "install" : "activate";
}

export function getReleaseDisplayName(install: Distributive): string {
    return getReleaseNameDisplay(install.manifest.releaseName || install.manifest.releaseId);
}

export function getReleaseNameDisplay(value: string): string {
    const buildId = value.match(/20\d{2}-\d{2}-\d{2}-\d{4}/)?.[0];
    if (buildId !== undefined) return buildId;
    return value
        .replace(/^Cataclysm-DDA experimental build\s+/i, "")
        .replace(/^Cataclysm-DDA\s+/i, "")
        .replace(/^cdda-(?:windows|linux)-[^-]+(?:-[^-]+)*-/i, "")
        .replace(/\.(?:zip|tar\.gz|tgz)$/i, "")
        .trim();
}

export function getProgressTitle(progress: InstallDistributiveProgress, t: Translate): string {
    if (progress.status === "downloading") return t("install.progress.downloading", { version: getReleaseNameDisplay(progress.releaseName) });
    if (progress.status === "extracting") return t("install.progress.extracting", { version: getReleaseNameDisplay(progress.releaseName) });
    if (progress.status === "preparing-saves") return t("install.progress.preparingSaves");
    if (progress.status === "finalizing") return t("install.progress.finalizing");
    if (progress.status === "completed") return t("install.progress.completed");
    if (progress.status === "error") return t("install.progress.error");
    return t("install.progress.resolvingRelease");
}

export function getProgressDescription(progress: InstallDistributiveProgress, t: Translate): string {
    if (progress.status === "downloading")
        return t("install.progress.downloadingDescription", { size: formatBytes(progress.transferredBytes), total: progress.totalBytes === null ? "?" : formatBytes(progress.totalBytes) });
    if (progress.status === "extracting") return t("install.progress.extractingDescription", { version: progress.releaseName });
    if (progress.status === "preparing-saves") return t("install.progress.preparingSavesDescription");
    if (progress.status === "finalizing") return t("install.progress.finalizingDescription");
    if (progress.status === "completed") return t("install.progress.completedDescription");
    if (progress.status === "error") return progress.message;
    return t("install.progress.resolvingReleaseDescription");
}

export function getIndeterminateProgressValue(progress: InstallDistributiveProgress): number {
    if (progress.status === "extracting") return 58;
    if (progress.status === "preparing-saves") return 76;
    if (progress.status === "finalizing") return 90;
    if (progress.status === "completed") return 100;
    if (progress.status === "error") return 100;
    return 12;
}

export function isInstallRunning(isInstalling: boolean, progress: InstallDistributiveProgress): boolean {
    if (isInstalling) return true;

    switch (progress.status) {
        case "resolving-release":
        case "downloading":
        case "extracting":
        case "preparing-saves":
        case "finalizing":
            return true;
        default:
            return false;
    }
}

export function formatBytes(value: number): string {
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatBackupTimestamp(value: string | null): string | null {
    if (value === null) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const year = date.getFullYear().toString().padStart(4, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hour = date.getHours().toString().padStart(2, "0");
    const minute = date.getMinutes().toString().padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
