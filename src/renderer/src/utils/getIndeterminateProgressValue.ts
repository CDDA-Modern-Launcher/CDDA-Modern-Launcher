import { GameBundleInstallProgress } from "../../../shared/game-bundle/GameBundleInstallProgress";

export function getIndeterminateProgressValue(progress: GameBundleInstallProgress): number {
    if (progress.status === "extracting") return 58;
    if (progress.status === "preparing-saves") return 76;
    if (progress.status === "finalizing") return 90;
    if (progress.status === "completed") return 100;
    if (progress.status === "error") return 100;
    return 12;
}
