import { BrowserWindow, ipcMain } from "electron";

import { type AutoBackupCooldown, type AutoBackupLimit, type BackupRotationLimit, isAutoBackupCooldown, isAutoBackupLimit, isBackupRotationLimit } from "../../shared/backups";
import { type GameAssetVariant, isGameAssetVariant, type LauncherUserSettings } from "../../shared/gameAssetVariants";
import { LauncherSettingsStore } from "./LauncherSettingsStore";

export function setupLauncherSettingsIpc(settingsStore: LauncherSettingsStore): void {
    ipcMain.handle("settings:get", () => settingsStore.getUserSettings());
    ipcMain.handle("settings:set-game-asset-variant", async (_event, gameAssetVariant: GameAssetVariant): Promise<LauncherUserSettings> => {
        if (!isGameAssetVariant(gameAssetVariant)) {
            throw new Error(`Unsupported game asset variant: ${String(gameAssetVariant)}`);
        }

        await settingsStore.setGameAssetVariant(gameAssetVariant);
        return emitSettingsChanged(settingsStore);
    });
    ipcMain.handle("settings:set-backups-enabled", async (_event, backupsEnabled: boolean): Promise<LauncherUserSettings> => {
        await settingsStore.setBackupsEnabled(backupsEnabled);
        return emitSettingsChanged(settingsStore);
    });
    ipcMain.handle("settings:set-auto-backup-limit", async (_event, autoBackupLimit: AutoBackupLimit): Promise<LauncherUserSettings> => {
        if (!isAutoBackupLimit(autoBackupLimit)) {
            throw new Error(`Unsupported auto backup limit: ${String(autoBackupLimit)}`);
        }

        await settingsStore.setAutoBackupLimit(autoBackupLimit);
        return emitSettingsChanged(settingsStore);
    });
    ipcMain.handle("settings:set-auto-backup-cooldown", async (_event, autoBackupCooldown: AutoBackupCooldown): Promise<LauncherUserSettings> => {
        if (!isAutoBackupCooldown(autoBackupCooldown)) {
            throw new Error(`Unsupported auto backup cooldown: ${String(autoBackupCooldown)}`);
        }

        await settingsStore.setAutoBackupCooldown(autoBackupCooldown);
        return emitSettingsChanged(settingsStore);
    });
    ipcMain.handle("settings:set-manual-backup-rotation-limit", async (_event, manualBackupRotationLimit: BackupRotationLimit): Promise<LauncherUserSettings> => {
        if (!isBackupRotationLimit(manualBackupRotationLimit)) {
            throw new Error(`Unsupported manual backup rotation limit: ${String(manualBackupRotationLimit)}`);
        }

        await settingsStore.setManualBackupRotationLimit(manualBackupRotationLimit);
        return emitSettingsChanged(settingsStore);
    });
}

async function emitSettingsChanged(settingsStore: LauncherSettingsStore): Promise<LauncherUserSettings> {
    const settings = await settingsStore.getUserSettings();

    for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send("settings:changed", settings);
    }

    return settings;
}
