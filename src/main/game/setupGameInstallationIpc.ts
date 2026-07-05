import { BrowserWindow, ipcMain, shell } from "electron";

import { LocalizationService } from "../localization/LocalizationService";
import { GameInstallationService } from "./GameInstallationService";
import { BackupProgress } from "../../shared/backups/types/BackupProgress";
import { BackupSummaryUpdate } from "../../shared/backups/types/BackupSummaryUpdate";
import { GameSaveSummaryUpdate } from "../../shared/GameSaveSummaryUpdate";
import { GameSaveActivityUpdate } from "../../shared/GameSaveActivityUpdate";
import { GameLaunchOptions } from "../../shared/launch/GameLaunchOptions";
import { CreateManualBackupOptions } from "../../shared/backups/types/CreateManualBackupOptions";
import { InstallDistributiveOptions } from "../../shared/distributive/InstallDistributiveOptions";
import { DistributiveDeleteOptions } from "../../shared/distributive/DistributiveDeleteOptions";
import { EGameFolderOpenResult } from "../../shared/EGameFolderOpenResult";

type GameStateRequest = boolean | { refreshLatest?: boolean; forceRefresh?: boolean } | undefined;

export function setupGameInstallationIpc(gameInstallationService: GameInstallationService, localizationService: LocalizationService): void {
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

    gameInstallationService.onBackupProgress((progress: BackupProgress) => {
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send("game:backup-progress", progress);
        }
    });

    gameInstallationService.onBackupSummaryChanged((update: BackupSummaryUpdate) => {
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
    ipcMain.handle("game:install-latest", (_event, options: InstallDistributiveOptions) => gameInstallationService.installLatest(options));
    ipcMain.handle("game:set-active-install", (_event, installId: string) => gameInstallationService.setActiveInstall(installId));
    ipcMain.handle("game:delete-install", (_event, installId: string, options: DistributiveDeleteOptions) => gameInstallationService.deleteInstall(installId, options));
    ipcMain.handle("game:get-runtime-state", () => gameInstallationService.getRuntimeState());
    ipcMain.handle("game:launch-active-install", (_event, options: GameLaunchOptions | undefined) => gameInstallationService.launchActiveInstall(options ?? {}));
    ipcMain.handle("game:stop", () => gameInstallationService.stopGame());
    ipcMain.handle("game:open-install-folder", async (_event, installId: string): Promise<EGameFolderOpenResult> => openFolder(await gameInstallationService.getInstallFolder(installId), localizationService));
    ipcMain.handle("game:open-saves-folder", async (_event, installId: string): Promise<EGameFolderOpenResult> => openFolder(await gameInstallationService.getSavesFolder(installId), localizationService));
    ipcMain.handle("game:create-manual-backup", (_event, options: CreateManualBackupOptions | undefined) => gameInstallationService.createManualBackup(options ?? {}));
    ipcMain.handle("game:restore-backup", (_event, backupId: string) => gameInstallationService.restoreBackup(backupId));
    ipcMain.handle("game:delete-backup", (_event, backupId: string) => gameInstallationService.deleteBackup(backupId));
    ipcMain.handle("game:rename-backup", (_event, backupId: string, comment: string) => gameInstallationService.renameBackup(backupId, comment));
}

async function openFolder(path: string | null, localizationService: LocalizationService): Promise<EGameFolderOpenResult> {
    if (path === null) return { status: "unavailable", message: localizationService.t("game.error.folderUnavailable") };
    const error = await shell.openPath(path);
    return error.length === 0 ? { status: "opened" } : { status: "error", message: error };
}
