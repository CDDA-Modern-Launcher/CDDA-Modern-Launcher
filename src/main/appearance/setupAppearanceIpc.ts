import { BrowserWindow, ipcMain, nativeTheme } from "electron";

import { AppAppearance } from "../../shared/appearance";

export function setupAppearanceIpc(): void {
    nativeTheme.themeSource = "system";

    ipcMain.handle("appearance:get", () => getAppearance());

    nativeTheme.on("updated", () => {
        const appearance = getAppearance();

        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send("appearance:changed", appearance);
        }
    });
}

function getAppearance(): AppAppearance {
    return {
        colorScheme: nativeTheme.shouldUseDarkColors ? "dark" : "light"
    };
}
