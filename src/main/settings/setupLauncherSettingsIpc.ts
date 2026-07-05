import { BrowserWindow, ipcMain } from "electron";

import {
    isGameAssetVariant,
    type GameAssetVariant,
    type LauncherUserSettings
} from "../../shared/gameAssetVariants";
import { LauncherSettingsStore } from "./LauncherSettingsStore";

export function setupLauncherSettingsIpc(settingsStore: LauncherSettingsStore): void {
    ipcMain.handle("settings:get", () => settingsStore.getUserSettings());
    ipcMain.handle(
        "settings:set-game-asset-variant",
        async (_event, gameAssetVariant: GameAssetVariant): Promise<LauncherUserSettings> => {
            if (!isGameAssetVariant(gameAssetVariant)) {
                throw new Error(`Unsupported game asset variant: ${String(gameAssetVariant)}`);
            }

            await settingsStore.setGameAssetVariant(gameAssetVariant);
            const settings = await settingsStore.getUserSettings();

            for (const window of BrowserWindow.getAllWindows()) {
                window.webContents.send("settings:changed", settings);
            }

            return settings;
        }
    );
}
