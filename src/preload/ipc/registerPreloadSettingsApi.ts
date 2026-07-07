import { SettingsApi } from "../../shared/bridge-api/SettingsApi";
import { SettingsIPC } from "../../shared/SettingsIPC";
import { ipcRenderer, type IpcRendererEvent } from "electron";
import { Bridge } from "../../shared/bridge-api/Bridge";
import { TReleaseAssetVariant } from "../../shared/release-asset/TReleaseAssetVariant";
import { TAutoBackupLimit } from "../../shared/backups/types/TAutoBackupLimit";
import { TAutoBackupCooldown } from "../../shared/backups/types/TAutoBackupCooldown";
import { TBackupRotationLimit } from "../../shared/backups/types/TBackupRotationLimit";

export function registerPreloadSettingsApi(): SettingsApi {
    return {
        get: (): Promise<SettingsIPC> => ipcRenderer.invoke(Bridge.Settings.get),
        setReleaseAssetVariant: (gameAssetVariant: TReleaseAssetVariant): Promise<SettingsIPC> => ipcRenderer.invoke(Bridge.Settings.setReleaseAssetVariant, gameAssetVariant),
        setBackupsEnabled: (backupsEnabled: boolean): Promise<SettingsIPC> => ipcRenderer.invoke(Bridge.Settings.setBackupsEnabled, backupsEnabled),
        setAutoBackupLimit: (autoBackupLimit: TAutoBackupLimit): Promise<SettingsIPC> => ipcRenderer.invoke(Bridge.Settings.setAutoBackupLimit, autoBackupLimit),
        setAutoBackupCooldown: (autoBackupCooldown: TAutoBackupCooldown): Promise<SettingsIPC> => ipcRenderer.invoke(Bridge.Settings.setAutoBackupCooldown, autoBackupCooldown),
        setManualBackupRotationLimit: (manualBackupRotationLimit: TBackupRotationLimit): Promise<SettingsIPC> => ipcRenderer.invoke(Bridge.Settings.setBackupRotationLimit, manualBackupRotationLimit),
        onChanged: (callback: (settings: SettingsIPC) => void) => {
            const listener = (_event: IpcRendererEvent, settings: SettingsIPC): void => callback(settings);
            ipcRenderer.on(Bridge.Settings.changed, listener);
            return () => ipcRenderer.removeListener(Bridge.Settings.changed, listener);
        }
    };
}
