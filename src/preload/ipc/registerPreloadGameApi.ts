import { GameApi } from "../../shared/bridge-api/GameApi";
import { ipcRenderer, type IpcRendererEvent } from "electron";
import { Bridge } from "../../shared/bridge-api/Bridge";
import { GameBundleInstallOptions } from "../../shared/game-bundle/GameBundleInstallOptions";
import { GameBundleDeleteOptions } from "../../shared/game-bundle/GameBundleDeleteOptions";
import { GameLaunchOptions } from "../../shared/launch/GameLaunchOptions";
import { CreateManualBackupOptions } from "../../shared/backups/types/CreateManualBackupOptions";
import { EBackupCreateResult } from "../../shared/backups/types/EBackupCreateResult";
import { EBackupRestoreResult } from "../../shared/backups/types/EBackupRestoreResult";
import { EBackupDeleteResult } from "../../shared/backups/types/EBackupDeleteResult";
import { EBackupRenameResult } from "../../shared/backups/types/EBackupRenameResult";
import { GameBundleInstallProgress } from "../../shared/game-bundle/GameBundleInstallProgress";
import { GameRuntimeState } from "../../shared/GameRuntimeState";
import { GameSaveSummaryUpdate } from "../../shared/GameSaveSummaryUpdate";
import { GameSaveActivityUpdate } from "../../shared/GameSaveActivityUpdate";
import { BackupProgress } from "../../shared/backups/types/BackupProgress";
import { BackupSummaryUpdate } from "../../shared/backups/types/BackupSummaryUpdate";
import { GameFileOperationState } from "../../shared/game-bundle/GameFileOperationState";

export function registerPreloadGameApi(): GameApi {
    return {
        getState: (options?: boolean | { refreshLatest?: boolean; forceRefresh?: boolean }) => ipcRenderer.invoke(Bridge.Game.getState, options),
        getReleases: (forceRefresh?: boolean) => ipcRenderer.invoke(Bridge.Game.getReleases, forceRefresh),
        installLatestGameBundle: (options: GameBundleInstallOptions) => ipcRenderer.invoke(Bridge.Game.installLatestGameBundle, options),
        setActiveGameBundle: (gameBundleId: string) => ipcRenderer.invoke(Bridge.Game.setActiveGameBundle, gameBundleId),
        deleteGameBundle: (gameBundleId: string, options: GameBundleDeleteOptions) => ipcRenderer.invoke(Bridge.Game.deleteGameBundle, gameBundleId, options),
        getRuntimeState: () => ipcRenderer.invoke(Bridge.Game.getRuntimeState),
        launchActiveGameBundle: (options?: GameLaunchOptions) => ipcRenderer.invoke(Bridge.Game.launchActiveGameBundle, options),
        stop: () => ipcRenderer.invoke(Bridge.Game.stop),
        openGameBundleFolder: (gameBundleId: string) => ipcRenderer.invoke(Bridge.Game.openGameBundleFolder, gameBundleId),
        openSavesFolder: (gameBundleId: string) => ipcRenderer.invoke(Bridge.Game.openSavesFolder, gameBundleId),
        createManualBackup: (options?: CreateManualBackupOptions): Promise<EBackupCreateResult> => ipcRenderer.invoke(Bridge.Game.createManualBackup, options),
        restoreBackup: (backupId: string): Promise<EBackupRestoreResult> => ipcRenderer.invoke(Bridge.Game.restoreBackup, backupId),
        deleteBackup: (backupId: string): Promise<EBackupDeleteResult> => ipcRenderer.invoke(Bridge.Game.deleteBackup, backupId),
        renameBackup: (backupId: string, comment: string): Promise<EBackupRenameResult> => ipcRenderer.invoke(Bridge.Game.renameBackup, backupId, comment),
        getFileOperation: () => ipcRenderer.invoke(Bridge.Game.getFileOperation),
        onFileOperationChanged: (callback: (operation: GameFileOperationState) => void) => {
            const listener = (_event: IpcRendererEvent, operation: GameFileOperationState): void => callback(operation);
            ipcRenderer.on(Bridge.Game.fileOperationChanged, listener);
            return () => ipcRenderer.removeListener(Bridge.Game.fileOperationChanged, listener);
        },
        onGameBundleInstallProgress: (callback: (progress: GameBundleInstallProgress) => void) => {
            const listener = (_event: IpcRendererEvent, progress: GameBundleInstallProgress): void => callback(progress);
            ipcRenderer.on(Bridge.Game.gameBundleInstallProgress, listener);
            return () => ipcRenderer.removeListener(Bridge.Game.gameBundleInstallProgress, listener);
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
