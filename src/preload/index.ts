import { electronAPI } from "@electron-toolkit/preload";
import { contextBridge } from "electron";

import { AppApi } from "../shared/bridge-api/AppApi";
import { registerPreloadAppearanceApi } from "./ipc/registerPreloadAppearanceApi";
import { registerPreloadWorkspaceApi } from "./ipc/registerPreloadWorkspaceApi";
import { registerPreloadSettingsApi } from "./ipc/registerPreloadSettingsApi";
import { registerPreloadUpdaterApi } from "./ipc/registerPreloadUpdaterApi";
import { registerPreloadLocalizationApi } from "./ipc/registerPreloadLocalizationApi";
import { registerPreloadShellApi } from "./ipc/registerPreloadShellApi";
import { registerPreloadGameApi } from "./ipc/registerPreloadGameApi";
import { registerPreloadModsApi } from "./ipc/registerPreloadModsApi";

const api: AppApi = {
    updater: registerPreloadUpdaterApi(),
    workspace: registerPreloadWorkspaceApi(),
    localization: registerPreloadLocalizationApi(),
    appearance: registerPreloadAppearanceApi(),
    shell: registerPreloadShellApi(),
    settings: registerPreloadSettingsApi(),
    game: registerPreloadGameApi(),
    mods: registerPreloadModsApi()
};

// Use `contextBridge` APIs to expose Electron APIs to renderer only if context isolation is enabled, otherwise just add to the DOM global.
if (process.contextIsolated) {
    console.log("Context isolated, exposing APIs...");
    try {
        contextBridge.exposeInMainWorld("electron", electronAPI);
        contextBridge.exposeInMainWorld("api", api);
    } catch (error) {
        console.error(error);
    }
} else {
    console.log("Context not isolated, adding APIs to global window...");
    window.electron = electronAPI;
    window.api = api;
}
