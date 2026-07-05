import { ElectronAPI } from "@electron-toolkit/preload";

import { AppApi } from "./bridge-api/AppApi";

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface Window {
        electron: ElectronAPI;
        api: AppApi;
    }
}
