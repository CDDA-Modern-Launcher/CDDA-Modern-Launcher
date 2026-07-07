import { BrowserWindow, ipcMain, nativeTheme } from "electron";

import { AppSettings } from "../settings/AppSettings";
import { AppearanceBundle } from "../../shared/bridge-api/AppearanceApi";
import { TAppThemeSource } from "../../shared/appearance/TAppThemeSource";
import { TAppTheme } from "../../shared/appearance/TAppTheme";
import { Bridge } from "../../shared/bridge-api/Bridge";

export async function registerMainAppearanceApi(settingsStore: AppSettings): Promise<void> {
    nativeTheme.themeSource = await settingsStore.getThemeSource();

    ipcMain.handle(Bridge.Appearance.getThemeSource, () => nativeTheme.themeSource);
    ipcMain.handle(Bridge.Appearance.setThemeSource, async (_event, themeSource: TAppThemeSource) => {
        await settingsStore.setThemeSource(themeSource);
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
