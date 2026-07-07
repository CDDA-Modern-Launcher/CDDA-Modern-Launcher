import { InstallDistributiveProgress } from "../../../shared/distributive/InstallDistributiveProgress";
import { formatBytes } from "@renderer/utils/formatBytes";
import { Translate } from "@renderer/components/home/homeUtils";

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
