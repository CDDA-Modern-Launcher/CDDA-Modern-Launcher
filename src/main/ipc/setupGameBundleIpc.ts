import { ipcMain, shell } from "electron";

import { LocalizationService } from "../LocalizationService";
import { GameBundleService } from "../GameBundleService";
import { GameLaunchOptions } from "../../shared/launch/GameLaunchOptions";
import { CreateManualBackupOptions } from "../../shared/backups/types/CreateManualBackupOptions";
import { GameBundleInstallOptions } from "../../shared/game-bundle/GameBundleInstallOptions";
import { GameBundleDeleteOptions } from "../../shared/game-bundle/GameBundleDeleteOptions";
import { EGameFolderOpenResult } from "../../shared/EGameFolderOpenResult";
import { Bridge } from "../../shared/bridge-api/Bridge";

/** @deprecated todo remove this weird type of arguments. */
type GameStateRequest = boolean | { refreshLatest?: boolean; forceRefresh?: boolean } | undefined;

export function setupGameBundleIpc(gameBundleService: GameBundleService, localizationService: LocalizationService): void {
    ipcMain.handle(Bridge.Game.getState, (_event, request: GameStateRequest) => {
        const refreshLatest = typeof request === "boolean" ? request : request?.refreshLatest === true;
        const forceRefresh = typeof request === "object" && request?.forceRefresh === true;
        return gameBundleService.getStateAndEmit(refreshLatest, forceRefresh);
    });
    ipcMain.handle(Bridge.Game.getReleases, (_event, forceRefresh: boolean | undefined) => gameBundleService.getReleases(forceRefresh === true));
    ipcMain.handle(Bridge.Game.installLatestGameBundle, (_event, options: GameBundleInstallOptions) => gameBundleService.installLatestGameBundle(options));
    ipcMain.handle(Bridge.Game.setActiveGameBundle, (_event, gameBundleId: string) => gameBundleService.setActiveGameBundle(gameBundleId));
    ipcMain.handle(Bridge.Game.deleteGameBundle, (_event, gameBundleId: string, options: GameBundleDeleteOptions) => gameBundleService.deleteGameBundle(gameBundleId, options));
    ipcMain.handle(Bridge.Game.getRuntimeState, () => gameBundleService.getRuntimeState());
    ipcMain.handle(Bridge.Game.launchActiveGameBundle, (_event, options: GameLaunchOptions | undefined) => gameBundleService.launchActiveGameBundle(options ?? {}));
    ipcMain.handle(Bridge.Game.stop, () => gameBundleService.stopGame());
    ipcMain.handle(Bridge.Game.openGameBundleFolder, async (_event, gameBundleId: string): Promise<EGameFolderOpenResult> => openFolder(await gameBundleService.getGameBundleFolder(gameBundleId), localizationService));
    ipcMain.handle(Bridge.Game.openSavesFolder, async (_event, gameBundleId: string): Promise<EGameFolderOpenResult> => openFolder(await gameBundleService.getSavesFolder(gameBundleId), localizationService));
    ipcMain.handle(Bridge.Game.createManualBackup, (_event, options: CreateManualBackupOptions | undefined) => gameBundleService.createManualBackup(options ?? {}));
    ipcMain.handle(Bridge.Game.restoreBackup, (_event, backupId: string) => gameBundleService.restoreBackup(backupId));
    ipcMain.handle(Bridge.Game.deleteBackup, (_event, backupId: string) => gameBundleService.deleteBackup(backupId));
    ipcMain.handle(Bridge.Game.renameBackup, (_event, backupId: string, comment: string) => gameBundleService.renameBackup(backupId, comment));
    ipcMain.handle(Bridge.Game.getFileOperation, () => gameBundleService.getFileOperation());
}

async function openFolder(path: string | null, localizationService: LocalizationService): Promise<EGameFolderOpenResult> {
    if (path === null) return { status: "unavailable", message: localizationService.t("game.error.folder.unavailable") };
    const error = await shell.openPath(path);
    return error.length === 0 ? { status: "opened" } : { status: "error", message: error };
}
