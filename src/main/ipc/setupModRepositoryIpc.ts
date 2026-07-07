import { ipcMain } from "electron";

import { ModRepositoryService } from "../mods/ModRepositoryService";
import { UpdateModOptions } from "../../shared/mods/UpdateModOptions";
import { Bridge } from "../../shared/bridge-api/Bridge";

export function setupModRepositoryIpc(modRepositoryService: ModRepositoryService): void {
    ipcMain.handle(Bridge.Mods.getState, () => modRepositoryService.getState());
    ipcMain.handle(Bridge.Mods.installFromUrl, (_event, url: string) => modRepositoryService.installFromUrl(url));
    ipcMain.handle(Bridge.Mods.checkUpdates, () => modRepositoryService.checkAll());
    ipcMain.handle(Bridge.Mods.update, (_event, modId: string, options?: UpdateModOptions) => modRepositoryService.update(modId, options));
    ipcMain.handle(Bridge.Mods.remove, (_event, modId: string) => modRepositoryService.remove(modId));
    ipcMain.handle(Bridge.Mods.openFolder, (_event, modId?: string) => modRepositoryService.openFolder(modId));
}
