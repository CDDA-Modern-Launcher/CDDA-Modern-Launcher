import { BrowserWindow, ipcMain } from "electron";

import { WorkspaceService } from "../repository/WorkspaceService";
import { TBackupRotationLimit } from "../../shared/backups/types/TBackupRotationLimit";
import { TAutoBackupLimit } from "../../shared/backups/types/TAutoBackupLimit";
import { TAutoBackupCooldown } from "../../shared/backups/types/TAutoBackupCooldown";
import { isAutoBackupLimit } from "../../shared/backups/isAutoBackupLimit";
import { isBackupRotationLimit } from "../../shared/backups/isBackupRotationLimit";
import { isAutoBackupCooldown } from "../../shared/backups/isAutoBackupCooldown";
import { TReleaseAssetVariant } from "../../shared/release-asset/TReleaseAssetVariant";
import { SettingsIPC } from "../../shared/SettingsIPC";
import { isReleaseAssetVariant } from "../../shared/release-asset/isReleaseAssetVariant";
import { Bridge } from "../../shared/bridge-api/Bridge";

export function setupLauncherSettingsIpc(repositoryService: WorkspaceService): void {
    repositoryService.listenWorkspaceSettings((settings) => {
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send(Bridge.Settings.changed, settings);
        }
    });

    ipcMain.handle(Bridge.Settings.get, () => repositoryService.getWorkspaceSettings());

    ipcMain.handle(Bridge.Settings.setReleaseAssetVariant, async (_event, releaseAssetVariant: TReleaseAssetVariant): Promise<SettingsIPC> => {
        if (!isReleaseAssetVariant(releaseAssetVariant)) throw new Error(`Unsupported game asset variant: ${String(releaseAssetVariant)}`);
        return repositoryService.updateWorkspaceSettings({ releaseAssetVariant });
    });

    ipcMain.handle(Bridge.Settings.setBackupsEnabled, async (_event, backupsEnabled: boolean): Promise<SettingsIPC> => {
        return repositoryService.updateWorkspaceSettings({ backupsEnabled });
    });

    ipcMain.handle(Bridge.Settings.setAutoBackupLimit, async (_event, autoBackupLimit: TAutoBackupLimit): Promise<SettingsIPC> => {
        if (!isAutoBackupLimit(autoBackupLimit)) throw new Error(`Unsupported auto backup limit: ${String(autoBackupLimit)}`);
        return repositoryService.updateWorkspaceSettings({ autoBackupLimit });
    });

    ipcMain.handle(Bridge.Settings.setAutoBackupCooldown, async (_event, autoBackupCooldown: TAutoBackupCooldown): Promise<SettingsIPC> => {
        if (!isAutoBackupCooldown(autoBackupCooldown)) throw new Error(`Unsupported auto backup cooldown: ${String(autoBackupCooldown)}`);
        return repositoryService.updateWorkspaceSettings({ autoBackupCooldown });
    });

    ipcMain.handle(Bridge.Settings.setBackupRotationLimit, async (_event, manualBackupRotationLimit: TBackupRotationLimit): Promise<SettingsIPC> => {
        if (!isBackupRotationLimit(manualBackupRotationLimit)) throw new Error(`Unsupported manual backup rotation limit: ${String(manualBackupRotationLimit)}`);
        return repositoryService.updateWorkspaceSettings({ manualBackupRotationLimit });
    });
}
