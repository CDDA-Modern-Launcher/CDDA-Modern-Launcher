import { ipcMain } from "electron";

import { ModRepositoryService } from "./ModRepositoryService";
import { UpdateModOptions } from "../../shared/mods/UpdateModOptions";

export function setupModRepositoryIpc(modRepositoryService: ModRepositoryService): void {
    ipcMain.handle("mods:get-state", () => modRepositoryService.getState());
    ipcMain.handle("mods:install-from-url", (_event, url: string) => modRepositoryService.installFromUrl(url));
    ipcMain.handle("mods:check-updates", () => modRepositoryService.checkAll());
    ipcMain.handle("mods:update", (_event, modId: string, options?: UpdateModOptions) => modRepositoryService.update(modId, options));
    ipcMain.handle("mods:remove", (_event, modId: string) => modRepositoryService.remove(modId));
    ipcMain.handle("mods:open-folder", (_event, modId?: string) => modRepositoryService.openFolder(modId));
}
