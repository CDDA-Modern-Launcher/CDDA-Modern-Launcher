import { ipcMain, shell } from "electron";

import { LocalizationService } from "../localization/LocalizationService";
import { GameBundleService } from "../game/GameBundleService";
import { GameLaunchOptions } from "../../shared/launch/GameLaunchOptions";
import { CreateManualBackupOptions } from "../../shared/backups/types/CreateManualBackupOptions";
import { InstallOptions } from "../../shared/distributive/InstallOptions";
import { GameBundleDeleteOptions } from "../../shared/distributive/GameBundleDeleteOptions";
import { EGameFolderOpenResult } from "../../shared/EGameFolderOpenResult";
import { Bridge } from "../../shared/bridge-api/Bridge";

/** @deprecated */
type GameStateRequest = boolean | { refreshLatest?: boolean; forceRefresh?: boolean } | undefined;

export function setupGameInstallationIpc(gameInstallationService: GameBundleService, localizationService: LocalizationService): void {
    ipcMain.handle(Bridge.Game.getState, (_event, request: GameStateRequest) => {
        const refreshLatest = typeof request === "boolean" ? request : request?.refreshLatest === true;
        const forceRefresh = typeof request === "object" && request?.forceRefresh === true;
        return gameInstallationService.getState(refreshLatest, forceRefresh);
    });
    ipcMain.handle(Bridge.Game.getReleases, (_event, forceRefresh: boolean | undefined) => gameInstallationService.getReleases(forceRefresh === true));
    ipcMain.handle(Bridge.Game.installLatest, (_event, options: InstallOptions) => gameInstallationService.installLatest(options));
    ipcMain.handle(Bridge.Game.setActiveInstall, (_event, installId: string) => gameInstallationService.setActiveInstall(installId));
    ipcMain.handle(Bridge.Game.deleteInstall, (_event, installId: string, options: GameBundleDeleteOptions) => gameInstallationService.deleteInstall(installId, options));
    ipcMain.handle(Bridge.Game.getRuntimeState, () => gameInstallationService.getRuntimeState());
    ipcMain.handle(Bridge.Game.launchActiveInstall, (_event, options: GameLaunchOptions | undefined) => gameInstallationService.launchActiveInstall(options ?? {}));
    ipcMain.handle(Bridge.Game.stop, () => gameInstallationService.stopGame());
    ipcMain.handle(Bridge.Game.openInstallFolder, async (_event, installId: string): Promise<EGameFolderOpenResult> => openFolder(await gameInstallationService.getInstallFolder(installId), localizationService));
    ipcMain.handle(Bridge.Game.openSavesFolder, async (_event, installId: string): Promise<EGameFolderOpenResult> => openFolder(await gameInstallationService.getSavesFolder(installId), localizationService));
    ipcMain.handle(Bridge.Game.createManualBackup, (_event, options: CreateManualBackupOptions | undefined) => gameInstallationService.createManualBackup(options ?? {}));
    ipcMain.handle(Bridge.Game.restoreBackup, (_event, backupId: string) => gameInstallationService.restoreBackup(backupId));
    ipcMain.handle(Bridge.Game.deleteBackup, (_event, backupId: string) => gameInstallationService.deleteBackup(backupId));
    ipcMain.handle(Bridge.Game.renameBackup, (_event, backupId: string, comment: string) => gameInstallationService.renameBackup(backupId, comment));
}

async function openFolder(path: string | null, localizationService: LocalizationService): Promise<EGameFolderOpenResult> {
    if (path === null) return { status: "unavailable", message: localizationService.t("game.error.folderUnavailable") };
    const error = await shell.openPath(path);
    return error.length === 0 ? { status: "opened" } : { status: "error", message: error };
}
