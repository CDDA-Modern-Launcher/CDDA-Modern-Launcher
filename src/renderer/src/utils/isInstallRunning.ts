import { InstallProgress } from "../../../shared/distributive/InstallProgress";

export function isInstallRunning(isInstalling: boolean, progress: InstallProgress): boolean {
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
