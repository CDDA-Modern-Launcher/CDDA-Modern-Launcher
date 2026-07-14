import { ipcMain } from "electron";

import { Bridge } from "../../shared/bridge-api/Bridge";
import { UpdaterService } from "../UpdaterService";

export function setupUpdaterIpc(updaterService: UpdaterService): void {
    ipcMain.handle(Bridge.Updater.getState, () => updaterService.getState());
    ipcMain.handle(Bridge.Updater.checkNow, () => updaterService.checkNow());
    ipcMain.handle(Bridge.Updater.downloadNow, () => updaterService.downloadNow());
    ipcMain.handle(Bridge.Updater.installNow, () => updaterService.installNow());
    ipcMain.handle(Bridge.Updater.dismiss, () => updaterService.dismiss());
    ipcMain.handle(Bridge.Updater.skipVersion, (_event, version: string) => updaterService.skipVersion(version));
}
