import { BrowserWindow, ipcMain } from "electron";

import { LocalRepositoryService } from "../repository/LocalRepositoryService";
import { TBackupRotationLimit } from "../../shared/backups/types/TBackupRotationLimit";
import { TAutoBackupLimit } from "../../shared/backups/types/TAutoBackupLimit";
import { TAutoBackupCooldown } from "../../shared/backups/types/TAutoBackupCooldown";
import { isAutoBackupLimit } from "../../shared/backups/isAutoBackupLimit";
import { isBackupRotationLimit } from "../../shared/backups/isBackupRotationLimit";
import { isAutoBackupCooldown } from "../../shared/backups/isAutoBackupCooldown";
import { TReleaseAssetVariant } from "../../shared/release-asset/TReleaseAssetVariant";
import { SettingsIPC } from "../../shared/SettingsIPC";
import { isReleaseAssetVariant } from "../../shared/release-asset/isReleaseAssetVariant";

export function setupLauncherSettingsIpc(repositoryService: LocalRepositoryService): void {
    repositoryService.onUserSettingsChanged((settings) => emitSettingsChanged(settings));

    ipcMain.handle("settings:get", () => repositoryService.getUserSettings());
    ipcMain.handle("settings:set-game-asset-variant", async (_event, gameAssetVariant: TReleaseAssetVariant): Promise<SettingsIPC> => {
        if (!isReleaseAssetVariant(gameAssetVariant)) {
            throw new Error(`Unsupported game asset variant: ${String(gameAssetVariant)}`);
        }

        return repositoryService.setGameAssetVariant(gameAssetVariant);
    });
    ipcMain.handle("settings:set-backups-enabled", async (_event, backupsEnabled: boolean): Promise<SettingsIPC> => repositoryService.setBackupsEnabled(backupsEnabled));
    ipcMain.handle("settings:set-auto-backup-limit", async (_event, autoBackupLimit: TAutoBackupLimit): Promise<SettingsIPC> => {
        if (!isAutoBackupLimit(autoBackupLimit)) {
            throw new Error(`Unsupported auto backup limit: ${String(autoBackupLimit)}`);
        }

        return repositoryService.setAutoBackupLimit(autoBackupLimit);
    });
    ipcMain.handle("settings:set-auto-backup-cooldown", async (_event, autoBackupCooldown: TAutoBackupCooldown): Promise<SettingsIPC> => {
        if (!isAutoBackupCooldown(autoBackupCooldown)) {
            throw new Error(`Unsupported auto backup cooldown: ${String(autoBackupCooldown)}`);
        }

        return repositoryService.setAutoBackupCooldown(autoBackupCooldown);
    });
    ipcMain.handle("settings:set-manual-backup-rotation-limit", async (_event, manualBackupRotationLimit: TBackupRotationLimit): Promise<SettingsIPC> => {
        if (!isBackupRotationLimit(manualBackupRotationLimit)) {
            throw new Error(`Unsupported manual backup rotation limit: ${String(manualBackupRotationLimit)}`);
        }

        return repositoryService.setManualBackupRotationLimit(manualBackupRotationLimit);
    });
}

function emitSettingsChanged(settings: SettingsIPC): void {
    for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send("settings:changed", settings);
    }
}
