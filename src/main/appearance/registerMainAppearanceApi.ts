import { BrowserWindow, ipcMain, nativeTheme } from "electron";

import { LauncherSettingsStore } from "../settings/LauncherSettingsStore";
import { AppearanceApiKey, AppearanceBundle } from "../../shared/bridge-api/AppearanceApi";
import { TAppThemeSource } from "../../shared/appearance/TAppThemeSource";
import { TAppTheme } from "../../shared/appearance/TAppTheme";

export async function registerMainAppearanceApi(settingsStore: LauncherSettingsStore): Promise<void> {
    nativeTheme.themeSource = await settingsStore.getThemeSource();

    ipcMain.handle(AppearanceApiKey.getThemeSource, () => nativeTheme.themeSource);
    ipcMain.handle(AppearanceApiKey.setThemeSource, async (_event, themeSource: TAppThemeSource) => {
        await settingsStore.setThemeSource(themeSource);
        nativeTheme.themeSource = themeSource;
        return getAppearanceBundle();
    });

    ipcMain.handle(AppearanceApiKey.getTheme, () => getTheme());

    nativeTheme.on("updated", () => {
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send(AppearanceApiKey.onAppearanceChanged, getAppearanceBundle());
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
