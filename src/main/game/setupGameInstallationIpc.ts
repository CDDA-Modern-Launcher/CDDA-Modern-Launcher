import { BrowserWindow, ipcMain, shell } from "electron";

import type { GameBackupProgress, GameBackupSummaryUpdate } from "../../shared/backups";
import type { CreateManualBackupOptions, DeleteGameInstallOptions, GameSaveActivityUpdate, GameSaveSummaryUpdate, InstallGameOptions, LaunchGameOptions, OpenGameFolderResult } from "../../shared/gameInstallations";
import { GameInstallationService } from "./GameInstallationService";

type GameStateRequest = boolean | { refreshLatest?: boolean; forceRefresh?: boolean } | undefined;

export function setupGameInstallationIpc(gameInstallationService: GameInstallationService): void {
    gameInstallationService.onProgress((progress) => {
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send("game:install-progress", progress);
        }
    });

    gameInstallationService.onRuntimeChanged((runtime) => {
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send("game:runtime-changed", runtime);
        }
    });

    gameInstallationService.onSaveSummaryChanged((update: GameSaveSummaryUpdate) => {
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send("game:save-summary-changed", update);
        }
    });

    gameInstallationService.onSaveActivityChanged((update: GameSaveActivityUpdate) => {
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send("game:save-activity-changed", update);
        }
    });

    gameInstallationService.onBackupProgress((progress: GameBackupProgress) => {
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send("game:backup-progress", progress);
        }
    });

    gameInstallationService.onBackupSummaryChanged((update: GameBackupSummaryUpdate) => {
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send("game:backup-summary-changed", update);
        }
    });

    ipcMain.handle("game:get-state", (_event, request: GameStateRequest) => {
        const refreshLatest = typeof request === "boolean" ? request : request?.refreshLatest === true;
        const forceRefresh = typeof request === "object" && request?.forceRefresh === true;
        return gameInstallationService.getState(refreshLatest, forceRefresh);
    });
    ipcMain.handle("game:get-releases", (_event, forceRefresh: boolean | undefined) => gameInstallationService.getReleases(forceRefresh === true));
    ipcMain.handle("game:install-latest", (_event, options: InstallGameOptions) => gameInstallationService.installLatest(options));
    ipcMain.handle("game:set-active-install", (_event, installId: string) => gameInstallationService.setActiveInstall(installId));
    ipcMain.handle("game:delete-install", (_event, installId: string, options: DeleteGameInstallOptions) => gameInstallationService.deleteInstall(installId, options));
    ipcMain.handle("game:get-runtime-state", () => gameInstallationService.getRuntimeState());
    ipcMain.handle("game:launch-active-install", (_event, options: LaunchGameOptions | undefined) => gameInstallationService.launchActiveInstall(options ?? {}));
    ipcMain.handle("game:stop", () => gameInstallationService.stopGame());
    ipcMain.handle("game:open-install-folder", async (_event, installId: string): Promise<OpenGameFolderResult> => openFolder(await gameInstallationService.getInstallFolder(installId)));
    ipcMain.handle("game:open-saves-folder", async (_event, installId: string): Promise<OpenGameFolderResult> => openFolder(await gameInstallationService.getSavesFolder(installId)));
    ipcMain.handle("game:create-manual-backup", (_event, options: CreateManualBackupOptions | undefined) => gameInstallationService.createManualBackup(options ?? {}));
    ipcMain.handle("game:restore-backup", (_event, backupId: string) => gameInstallationService.restoreBackup(backupId));
    ipcMain.handle("game:delete-backup", (_event, backupId: string) => gameInstallationService.deleteBackup(backupId));
    ipcMain.handle("game:rename-backup", (_event, backupId: string, comment: string) => gameInstallationService.renameBackup(backupId, comment));
}

async function openFolder(path: string | null): Promise<OpenGameFolderResult> {
    if (path === null) return { status: "unavailable", message: "Folder is not available." };
    const error = await shell.openPath(path);
    return error.length === 0 ? { status: "opened" } : { status: "error", message: error };
}
