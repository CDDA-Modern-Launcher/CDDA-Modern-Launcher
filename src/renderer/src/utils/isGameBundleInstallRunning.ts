import { GameBundleInstallProgress } from "../../../shared/game-bundle/GameBundleInstallProgress";

export function isGameBundleInstallRunning(isInstallingGameBundle: boolean, progress: GameBundleInstallProgress): boolean {
    if (isInstallingGameBundle) return true;

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
