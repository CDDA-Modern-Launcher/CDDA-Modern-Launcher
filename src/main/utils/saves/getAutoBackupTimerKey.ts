export function getAutoBackupTimerKey(installId: string, worldFolderName: string): string {
    return `${installId}:${worldFolderName}`;
}
