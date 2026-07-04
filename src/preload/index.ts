import { electronAPI } from "@electron-toolkit/preload";
import type { IpcRendererEvent } from "electron";
import { contextBridge, ipcRenderer } from "electron";

import { AppAppearance } from "../shared/appearance";
import { LocalizationBundle } from "../shared/localization";
import { RepositoryStatus, SelectRepositoryResult } from "../shared/repository";

const updaterApi = {
    getState: () => ipcRenderer.invoke("updater:get-state"),
    checkNow: () => ipcRenderer.invoke("updater:check-now"),
    installNow: () => ipcRenderer.invoke("updater:install-now"),
    dismiss: () => ipcRenderer.invoke("updater:dismiss"),
    skipVersion: (version: string) => ipcRenderer.invoke("updater:skip-version", version),
    showMockDownloadedUpdate: (version?: string) => ipcRenderer.invoke("updater:mock-downloaded", version),
    onStateChanged: (callback: (state: unknown) => void) => {
        const listener = (_event: IpcRendererEvent, state: unknown): void => callback(state);

        ipcRenderer.on("updater:state-changed", listener);

        return () => {
            ipcRenderer.removeListener("updater:state-changed", listener);
        };
    }
};

const repositoryApi = {
    getStatus: (): Promise<RepositoryStatus> => ipcRenderer.invoke("repository:get-status"),
    selectFolder: (): Promise<SelectRepositoryResult> => ipcRenderer.invoke("repository:select-folder")
};

const localizationApi = {
    getBundle: (): Promise<LocalizationBundle> => ipcRenderer.invoke("localization:get-bundle"),
    setLocale: (locale: string): Promise<LocalizationBundle> => ipcRenderer.invoke("localization:set-locale", locale),
    onChanged: (callback: (bundle: LocalizationBundle) => void) => {
        const listener = (_event: IpcRendererEvent, bundle: LocalizationBundle): void => callback(bundle);

        ipcRenderer.on("localization:changed", listener);

        return () => {
            ipcRenderer.removeListener("localization:changed", listener);
        };
    }
};

const appearanceApi = {
    get: (): Promise<AppAppearance> => ipcRenderer.invoke("appearance:get"),
    onChanged: (callback: (appearance: AppAppearance) => void) => {
        const listener = (_event: IpcRendererEvent, appearance: AppAppearance): void => callback(appearance);

        ipcRenderer.on("appearance:changed", listener);

        return () => {
            ipcRenderer.removeListener("appearance:changed", listener);
        };
    }
};

// Custom APIs for renderer
const api = {
    updater: updaterApi,
    repository: repositoryApi,
    localization: localizationApi,
    appearance: appearanceApi
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld("electron", electronAPI);
        contextBridge.exposeInMainWorld("api", api);
    } catch (error) {
        console.error(error);
    }
} else {
    // @ts-ignore (define in dts)
    window.electron = electronAPI;
    // @ts-ignore (define in dts)
    window.api = api;
}
