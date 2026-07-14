import { UpdaterApi } from "../../shared/bridge-api/UpdaterApi";
import { ipcRenderer, type IpcRendererEvent } from "electron";
import { UpdateState } from "../../shared/bridge-api/types/UpdateState";
import { Bridge } from "../../shared/bridge-api/Bridge";

export function registerPreloadUpdaterApi(): UpdaterApi {
    return {
        getState: () => ipcRenderer.invoke(Bridge.Updater.getState),
        checkNow: () => ipcRenderer.invoke(Bridge.Updater.checkNow),
        downloadNow: () => ipcRenderer.invoke(Bridge.Updater.downloadNow),
        installNow: () => ipcRenderer.invoke(Bridge.Updater.installNow),
        dismiss: () => ipcRenderer.invoke(Bridge.Updater.dismiss),
        skipVersion: (version: string) => ipcRenderer.invoke(Bridge.Updater.skipVersion, version),
        onStateChanged: (callback: (state: UpdateState) => void) => {
            const listener = (_event: IpcRendererEvent, state: UpdateState): void => callback(state);
            ipcRenderer.on(Bridge.Updater.onStateChanged, listener);
            return () => ipcRenderer.removeListener(Bridge.Updater.onStateChanged, listener);
        }
    };
}
