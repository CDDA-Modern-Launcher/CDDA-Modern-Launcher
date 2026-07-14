import { GameBundleInstallProgress } from "../../shared/game-bundle/GameBundleInstallProgress";
import { broadcastIPC } from "./broadcastIPC";
import { Bridge } from "../../shared/bridge-api/Bridge";

let lastInstallProgressKey = "";
let lastInstallProgressAt = 0;

export function broadcastInstallIPC(progress: GameBundleInstallProgress, immediate = false): boolean {
    if (!immediate && shouldThrottleInstallProgress(progress)) return false;
    lastInstallProgressKey = getInstallProgressKey(progress);
    lastInstallProgressAt = Date.now();
    broadcastIPC(Bridge.Game.gameBundleInstallProgress, progress);
    return true;
}

function shouldThrottleInstallProgress(progress: GameBundleInstallProgress): boolean {
    const key = getInstallProgressKey(progress);
    return key === lastInstallProgressKey && Date.now() - lastInstallProgressAt < 120;
}

function getInstallProgressKey(progress: GameBundleInstallProgress): string {
    if (progress.status === "downloading") {
        if (progress.percent !== null) return `${progress.status}:${progress.percent}`;
        return `${progress.status}:${Math.floor(progress.transferredBytes / 1024 / 1024)}`;
    }
    if (progress.status === "extracting") return `${progress.status}:${progress.percent}`;
    return progress.status;
}
