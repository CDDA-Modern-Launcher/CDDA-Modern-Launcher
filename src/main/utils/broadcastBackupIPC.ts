import { BackupProgress } from "../../shared/backups/types/BackupProgress";
import { broadcastIPC } from "./broadcastIPC";
import { Bridge } from "../../shared/bridge-api/Bridge";

let lastBackupProgressKey = "";
let lastBackupProgressAt = 0;

export function broadcastBackupIPC(progress: BackupProgress, immediate = false): void {
    if (!immediate && shouldThrottleBackupProgress(progress)) return;
    lastBackupProgressKey = getBackupProgressKey(progress);
    lastBackupProgressAt = Date.now();
    broadcastIPC(Bridge.Game.gameBackupProgress, progress);
}

function shouldThrottleBackupProgress(progress: BackupProgress): boolean {
    const key = getBackupProgressKey(progress);
    return key === lastBackupProgressKey && Date.now() - lastBackupProgressAt < 120;
}

function getBackupProgressKey(progress: BackupProgress): string {
    if (progress.status === "creating" || progress.status === "restoring") return `${progress.status}:${progress.percent ?? "unknown"}`;
    return progress.status;
}
