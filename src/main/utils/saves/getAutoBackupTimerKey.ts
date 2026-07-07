export function getAutoBackupTimerKey(gameBundleId: string, worldFolderName: string): string {
    return `${gameBundleId}:${worldFolderName}`;
}
