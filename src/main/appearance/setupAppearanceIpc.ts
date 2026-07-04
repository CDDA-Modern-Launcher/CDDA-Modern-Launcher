import { BrowserWindow, ipcMain, nativeTheme } from "electron";

import { AppAppearance, AppTheme } from "../../shared/appearance";
import { LauncherSettingsStore } from "../settings/LauncherSettingsStore";

export async function setupAppearanceIpc(settingsStore: LauncherSettingsStore): Promise<void> {
    nativeTheme.themeSource = await settingsStore.getTheme();

    ipcMain.handle("appearance:get", () => getAppearance());
    ipcMain.on("appearance:get-sync", (event) => {
        event.returnValue = getAppearance();
    });
    ipcMain.handle("appearance:set-theme", async (_event, theme: AppTheme) => {
        await settingsStore.setTheme(theme);
        nativeTheme.themeSource = theme;
        return getAppearance();
    });

    nativeTheme.on("updated", () => {
        notifyAppearanceChanged();
    });
}

function getAppearance(): AppAppearance {
    return {
        theme: nativeTheme.themeSource,
        colorScheme: nativeTheme.shouldUseDarkColors ? "dark" : "light"
    };
}

function notifyAppearanceChanged(): void {
    const appearance = getAppearance();

    for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send("appearance:changed", appearance);
    }
}
