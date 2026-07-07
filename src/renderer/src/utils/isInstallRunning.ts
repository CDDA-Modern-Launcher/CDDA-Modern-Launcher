import { InstallDistributiveProgress } from "../../../shared/distributive/InstallDistributiveProgress";

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
