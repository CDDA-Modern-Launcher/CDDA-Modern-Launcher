import { BrowserWindow, ipcMain, nativeTheme } from "electron";

import { AppearanceBundle } from "../../shared/bridge-api/AppearanceApi";
import { TAppThemeSource } from "../../shared/appearance/TAppThemeSource";
import { TAppTheme } from "../../shared/appearance/TAppTheme";
import { Bridge } from "../../shared/bridge-api/Bridge";
import { appSettings } from "../settings/AppSettings";

export function setupAppearanceIpc(): void {
    nativeTheme.themeSource = appSettings.get("theme");

    ipcMain.on(Bridge.Appearance.getInitialAppearance, (event) => {
        event.returnValue = getAppearanceBundle();
    });

    ipcMain.handle(Bridge.Appearance.getThemeSource, () => nativeTheme.themeSource);
    ipcMain.handle(Bridge.Appearance.setThemeSource, (_event, theme: TAppThemeSource) => {
        appSettings.set({ theme });
        nativeTheme.themeSource = theme;
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
