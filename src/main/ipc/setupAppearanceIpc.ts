import { BrowserWindow, ipcMain, nativeTheme } from "electron";

import { AppSettings } from "../settings/AppSettings";
import { AppearanceBundle } from "../../shared/bridge-api/AppearanceApi";
import { TAppThemeSource } from "../../shared/appearance/TAppThemeSource";
import { TAppTheme } from "../../shared/appearance/TAppTheme";
import { Bridge } from "../../shared/bridge-api/Bridge";

export function setupAppearanceIpc(settings: AppSettings): void {
    nativeTheme.themeSource = settings.get("theme");

    ipcMain.on(Bridge.Appearance.getInitialAppearance, (event) => {
        event.returnValue = getAppearanceBundle();
    });

    ipcMain.handle(Bridge.Appearance.getThemeSource, () => nativeTheme.themeSource);
    ipcMain.handle(Bridge.Appearance.setThemeSource, (_event, themeSource: TAppThemeSource) => {
        settings.set({ theme: themeSource });
        nativeTheme.themeSource = themeSource;
        return getAppearanceBundle();
    });

    ipcMain.handle(Bridge.Appearance.getTheme, () => getTheme());

    nativeTheme.on("updated", () => {
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send(Bridge.Appearance.onAppearanceChanged, getAppearanceBundle());
        }
    });
}

function getTheme(): TAppTheme {
    return nativeTheme.shouldUseDarkColors ? "dark" : "light";
}

function getAppearanceBundle(): AppearanceBundle {
    return {
        themeSource: nativeTheme.themeSource,
        theme: nativeTheme.shouldUseDarkColors ? "dark" : "light"
    };
}
