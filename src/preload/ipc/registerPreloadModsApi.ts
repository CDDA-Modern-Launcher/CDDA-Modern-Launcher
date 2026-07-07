import { ModsApi } from "../../shared/bridge-api/ModsApi";
import { ipcRenderer, type IpcRendererEvent } from "electron";
import { Bridge } from "../../shared/bridge-api/Bridge";
import { UpdateModOptions } from "../../shared/mods/UpdateModOptions";
import { ModRepositoryChangedEvent } from "../../shared/mods/ModRepositoryChangedEvent";
import { ModRepositoryNoticeEvent } from "../../shared/mods/ModRepositoryNoticeEvent";

export function registerPreloadModsApi(): ModsApi {
    return {
        getState: () => ipcRenderer.invoke(Bridge.Mods.getState),
        installFromUrl: (url: string) => ipcRenderer.invoke(Bridge.Mods.installFromUrl, url),
        checkUpdates: () => ipcRenderer.invoke(Bridge.Mods.checkUpdates),
        update: (modId: string, options?: UpdateModOptions) => ipcRenderer.invoke(Bridge.Mods.update, modId, options),
        remove: (modId: string) => ipcRenderer.invoke(Bridge.Mods.remove, modId),
        openFolder: (modId?: string) => ipcRenderer.invoke(Bridge.Mods.openFolder, modId),
        onChanged: (callback: (event: ModRepositoryChangedEvent) => void) => {
            const listener = (_event: IpcRendererEvent, event: ModRepositoryChangedEvent): void => callback(event);
            ipcRenderer.on(Bridge.Mods.onChanged, listener);
            return () => ipcRenderer.removeListener(Bridge.Mods.onChanged, listener);
        },
        onNotice: (callback: (event: ModRepositoryNoticeEvent) => void) => {
            const listener = (_event: IpcRendererEvent, event: ModRepositoryNoticeEvent): void => callback(event);
            ipcRenderer.on(Bridge.Mods.onNotice, listener);
            return () => ipcRenderer.removeListener(Bridge.Mods.onNotice, listener);
        }
    };
}
