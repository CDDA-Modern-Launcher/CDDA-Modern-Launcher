import { InstallDistributiveProgress } from "../../../shared/distributive/InstallDistributiveProgress";
import { Translate } from "@renderer/components/home/homeUtils";
import { getReleaseNameDisplay } from "@renderer/utils/getReleaseNameDisplay";

export function getProgressTitle(progress: InstallDistributiveProgress, t: Translate): string {
    if (progress.status === "downloading") return t("install.progress.downloading", { version: getReleaseNameDisplay(progress.releaseName) });
    if (progress.status === "extracting") return t("install.progress.extracting", { version: getReleaseNameDisplay(progress.releaseName) });
    if (progress.status === "preparing-saves") return t("install.progress.preparingSaves");
    if (progress.status === "finalizing") return t("install.progress.finalizing");
    if (progress.status === "completed") return t("install.progress.completed");
    if (progress.status === "error") return t("install.progress.error");
    return t("install.progress.resolvingRelease");
}
