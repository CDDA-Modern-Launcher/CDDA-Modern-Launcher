import { GameApi } from "../../shared/bridge-api/GameApi";
import { ipcRenderer, type IpcRendererEvent } from "electron";
import { Bridge } from "../../shared/bridge-api/Bridge";
import { InstallOptions } from "../../shared/distributive/InstallOptions";
import { GameBundleDeleteOptions } from "../../shared/distributive/GameBundleDeleteOptions";
import { GameLaunchOptions } from "../../shared/launch/GameLaunchOptions";
import { CreateManualBackupOptions } from "../../shared/backups/types/CreateManualBackupOptions";
import { EBackupCreateResult } from "../../shared/backups/types/EBackupCreateResult";
import { EBackupRestoreResult } from "../../shared/backups/types/EBackupRestoreResult";
import { EBackupDeleteResult } from "../../shared/backups/types/EBackupDeleteResult";
import { EBackupRenameResult } from "../../shared/backups/types/EBackupRenameResult";
import { InstallProgress } from "../../shared/distributive/InstallProgress";
import { GameRuntimeState } from "../../shared/GameRuntimeState";
import { GameSaveSummaryUpdate } from "../../shared/GameSaveSummaryUpdate";
import { GameSaveActivityUpdate } from "../../shared/GameSaveActivityUpdate";
import { BackupProgress } from "../../shared/backups/types/BackupProgress";
import { BackupSummaryUpdate } from "../../shared/backups/types/BackupSummaryUpdate";

export function registerPreloadGameApi(): GameApi {
    return {
        getState: (options?: boolean | { refreshLatest?: boolean; forceRefresh?: boolean }) => ipcRenderer.invoke(Bridge.Game.getState, options),
        getReleases: (forceRefresh?: boolean) => ipcRenderer.invoke(Bridge.Game.getReleases, forceRefresh),
        installLatest: (options: InstallOptions) => ipcRenderer.invoke(Bridge.Game.installLatest, options),
        setActiveInstall: (installId: string) => ipcRenderer.invoke(Bridge.Game.setActiveInstall, installId),
        deleteInstall: (installId: string, options: GameBundleDeleteOptions) => ipcRenderer.invoke(Bridge.Game.deleteInstall, installId, options),
        getRuntimeState: () => ipcRenderer.invoke(Bridge.Game.getRuntimeState),
        launchActiveInstall: (options?: GameLaunchOptions) => ipcRenderer.invoke(Bridge.Game.launchActiveInstall, options),
        stop: () => ipcRenderer.invoke(Bridge.Game.stop),
        openInstallFolder: (installId: string) => ipcRenderer.invoke(Bridge.Game.openInstallFolder, installId),
        openSavesFolder: (installId: string) => ipcRenderer.invoke(Bridge.Game.openSavesFolder, installId),
        createManualBackup: (options?: CreateManualBackupOptions): Promise<EBackupCreateResult> => ipcRenderer.invoke(Bridge.Game.createManualBackup, options),
        restoreBackup: (backupId: string): Promise<EBackupRestoreResult> => ipcRenderer.invoke(Bridge.Game.restoreBackup, backupId),
        deleteBackup: (backupId: string): Promise<EBackupDeleteResult> => ipcRenderer.invoke(Bridge.Game.deleteBackup, backupId),
        renameBackup: (backupId: string, comment: string): Promise<EBackupRenameResult> => ipcRenderer.invoke(Bridge.Game.renameBackup, backupId, comment),
        onInstallProgress: (callback: (progress: InstallProgress) => void) => {
            const listener = (_event: IpcRendererEvent, progress: InstallProgress): void => callback(progress);
            ipcRenderer.on(Bridge.Game.installProgress, listener);
            return () => ipcRenderer.removeListener(Bridge.Game.installProgress, listener);
        },
        onRuntimeChanged: (callback: (runtime: GameRuntimeState) => void) => {
            const listener = (_event: IpcRendererEvent, runtime: GameRuntimeState): void => callback(runtime);
            ipcRenderer.on(Bridge.Game.runtimeChanged, listener);
            return () => ipcRenderer.removeListener(Bridge.Game.runtimeChanged, listener);
        },
        onSaveSummaryChanged: (callback: (update: GameSaveSummaryUpdate) => void) => {
            const listener = (_event: IpcRendererEvent, update: GameSaveSummaryUpdate): void => callback(update);
            ipcRenderer.on(Bridge.Game.saveSummaryChanged, listener);
            return () => ipcRenderer.removeListener(Bridge.Game.saveSummaryChanged, listener);
        },
        onSaveActivityChanged: (callback: (update: GameSaveActivityUpdate) => void) => {
            const listener = (_event: IpcRendererEvent, update: GameSaveActivityUpdate): void => callback(update);
            ipcRenderer.on(Bridge.Game.saveActivityChanged, listener);
            return () => ipcRenderer.removeListener(Bridge.Game.saveActivityChanged, listener);
        },
        onBackupProgress: (callback: (progress: BackupProgress) => void) => {
            const listener = (_event: IpcRendererEvent, progress: BackupProgress): void => callback(progress);
            ipcRenderer.on(Bridge.Game.gameBackupProgress, listener);
            return () => ipcRenderer.removeListener(Bridge.Game.gameBackupProgress, listener);
        },
        onBackupSummaryChanged: (callback: (update: BackupSummaryUpdate) => void) => {
            const listener = (_event: IpcRendererEvent, update: BackupSummaryUpdate): void => callback(update);
            ipcRenderer.on(Bridge.Game.backupSummaryChanged, listener);
            return () => ipcRenderer.removeListener(Bridge.Game.backupSummaryChanged, listener);
        }
    };
}
