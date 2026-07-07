import { InstallProgress } from "../../../shared/distributive/InstallProgress";
import { getReleaseNameDisplay } from "@renderer/utils/getReleaseNameDisplay";
import { TLocalizeFn } from "@renderer/localization/useLocaleStore";

export function getProgressTitle(progress: InstallProgress, t: TLocalizeFn): string {
    if (progress.status === "downloading") return t("install.progress.downloading", { version: getReleaseNameDisplay(progress.releaseName) });
    if (progress.status === "extracting") return t("install.progress.extracting", { version: getReleaseNameDisplay(progress.releaseName) });
    if (progress.status === "preparing-saves") return t("install.progress.preparingSaves");
    if (progress.status === "finalizing") return t("install.progress.finalizing");
    if (progress.status === "completed") return t("install.progress.completed");
    if (progress.status === "error") return t("install.progress.error");
    return t("install.progress.resolvingRelease");
}
