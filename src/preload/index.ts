import { electronAPI } from "@electron-toolkit/preload";
import type { IpcRendererEvent } from "electron";
import { contextBridge, ipcRenderer } from "electron";

import { AppApi } from "../shared/bridge-api/AppApi";
import { AppearanceApi } from "../shared/bridge-api/AppearanceApi";
import { GameApi } from "../shared/bridge-api/GameApi";
import { LocalizationApi } from "../shared/bridge-api/LocalizationApi";
import { ModsApi } from "../shared/bridge-api/ModsApi";
import { RepositoryApi } from "../shared/bridge-api/RepositoryApi";
import { SettingsApi } from "../shared/bridge-api/SettingsApi";
import { ShellApi } from "../shared/bridge-api/ShellApi";
import { UpdateState } from "../shared/bridge-api/types/UpdateState";
import { UpdaterApi } from "../shared/bridge-api/UpdaterApi";
import { WorkspaceStatus } from "../shared/workspace/WorkspaceStatus";
import { EWorkspaceSelectResult } from "../shared/workspace/EWorkspaceSelectResult";
import { LocalizationBundle } from "../shared/localization/types/LocalizationBundle";
import { AppTheme } from "../shared/appearance/AppTheme";
import { AppAppearance } from "../shared/appearance/AppAppearance";
import { TBackupRotationLimit } from "../shared/backups/types/TBackupRotationLimit";
import { TAutoBackupLimit } from "../shared/backups/types/TAutoBackupLimit";
import { TAutoBackupCooldown } from "../shared/backups/types/TAutoBackupCooldown";
import { BackupProgress } from "../shared/backups/types/BackupProgress";
import { BackupSummaryUpdate } from "../shared/backups/types/BackupSummaryUpdate";
import { EBackupCreateResult } from "../shared/backups/types/EBackupCreateResult";
import { EBackupDeleteResult } from "../shared/backups/types/EBackupDeleteResult";
import { EBackupRestoreResult } from "../shared/backups/types/EBackupRestoreResult";

import { EBackupRenameResult } from "../shared/backups/types/EBackupRenameResult";
import { TReleaseAssetVariant } from "../shared/release-asset/TReleaseAssetVariant";
import { SettingsIPC } from "../shared/SettingsIPC";
import { GameSaveSummaryUpdate } from "../shared/GameSaveSummaryUpdate";
import { GameSaveActivityUpdate } from "../shared/GameSaveActivityUpdate";
import { GameRuntimeState } from "../shared/GameRuntimeState";
import { GameLaunchOptions } from "../shared/launch/GameLaunchOptions";
import { CreateManualBackupOptions } from "../shared/backups/types/CreateManualBackupOptions";
import { InstallDistributiveOptions } from "../shared/distributive/InstallDistributiveOptions";
import { DistributiveDeleteOptions } from "../shared/distributive/DistributiveDeleteOptions";
import { InstallDistributiveProgress } from "../shared/distributive/InstallDistributiveProgress";
import { UpdateModOptions } from "../shared/mods/UpdateModOptions";
import { ModRepositoryChangedEvent } from "../shared/mods/ModRepositoryChangedEvent";
import { ModRepositoryNoticeEvent } from "../shared/mods/ModRepositoryNoticeEvent";

const updaterApi: UpdaterApi = {
    getState: () => ipcRenderer.invoke("updater:get-state"),
    checkNow: () => ipcRenderer.invoke("updater:check-now"),
    installNow: () => ipcRenderer.invoke("updater:install-now"),
    dismiss: () => ipcRenderer.invoke("updater:dismiss"),
    skipVersion: (version: string) => ipcRenderer.invoke("updater:skip-version", version),
    showMockDownloadedUpdate: (version?: string) => ipcRenderer.invoke("updater:mock-downloaded", version),
    onStateChanged: (callback: (state: UpdateState) => void) => {
        const listener = (_event: IpcRendererEvent, state: UpdateState): void => callback(state);
        ipcRenderer.on("updater:state-changed", listener);
        return () => ipcRenderer.removeListener("updater:state-changed", listener);
    }
};

const repositoryApi: RepositoryApi = {
    getStatus: (): Promise<WorkspaceStatus> => ipcRenderer.invoke("repository:get-status"),
    selectFolder: (): Promise<EWorkspaceSelectResult> => ipcRenderer.invoke("repository:select-folder"),
    setSelectedChannel: (channelId: string): Promise<WorkspaceStatus> => ipcRenderer.invoke("repository:set-selected-channel", channelId)
};

const localizationApi: LocalizationApi = {
    getBundle: (): Promise<LocalizationBundle> => ipcRenderer.invoke("localization:get-bundle"),
    setLocale: (locale: string): Promise<LocalizationBundle> => ipcRenderer.invoke("localization:set-locale", locale),
    onChanged: (callback: (bundle: LocalizationBundle) => void) => {
        const listener = (_event: IpcRendererEvent, bundle: LocalizationBundle): void => callback(bundle);
        ipcRenderer.on("localization:changed", listener);
        return () => ipcRenderer.removeListener("localization:changed", listener);
    }
};

const appearanceApi: AppearanceApi = {
    getInitial: (): AppAppearance => ipcRenderer.sendSync("appearance:get-sync"),
    get: (): Promise<AppAppearance> => ipcRenderer.invoke("appearance:get"),
    setTheme: (theme: AppTheme): Promise<AppAppearance> => ipcRenderer.invoke("appearance:set-theme", theme),
    onChanged: (callback: (appearance: AppAppearance) => void) => {
        const listener = (_event: IpcRendererEvent, appearance: AppAppearance): void => callback(appearance);
        ipcRenderer.on("appearance:changed", listener);
        return () => ipcRenderer.removeListener("appearance:changed", listener);
    }
};

const shellApi: ShellApi = {
    openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke("shell:open-external", url)
};

const settingsApi: SettingsApi = {
    get: (): Promise<SettingsIPC> => ipcRenderer.invoke("settings:get"),
    setGameAssetVariant: (gameAssetVariant: TReleaseAssetVariant): Promise<SettingsIPC> => ipcRenderer.invoke("settings:set-game-asset-variant", gameAssetVariant),
    setBackupsEnabled: (backupsEnabled: boolean): Promise<SettingsIPC> => ipcRenderer.invoke("settings:set-backups-enabled", backupsEnabled),
    setAutoBackupLimit: (autoBackupLimit: TAutoBackupLimit): Promise<SettingsIPC> => ipcRenderer.invoke("settings:set-auto-backup-limit", autoBackupLimit),
    setAutoBackupCooldown: (autoBackupCooldown: TAutoBackupCooldown): Promise<SettingsIPC> => ipcRenderer.invoke("settings:set-auto-backup-cooldown", autoBackupCooldown),
    setManualBackupRotationLimit: (manualBackupRotationLimit: TBackupRotationLimit): Promise<SettingsIPC> => ipcRenderer.invoke("settings:set-manual-backup-rotation-limit", manualBackupRotationLimit),
    onChanged: (callback: (settings: SettingsIPC) => void) => {
        const listener = (_event: IpcRendererEvent, settings: SettingsIPC): void => callback(settings);
        ipcRenderer.on("settings:changed", listener);
        return () => ipcRenderer.removeListener("settings:changed", listener);
    }
};

const gameApi: GameApi = {
    getState: (options?: boolean | { refreshLatest?: boolean; forceRefresh?: boolean }) => ipcRenderer.invoke("game:get-state", options),
    getReleases: (forceRefresh?: boolean) => ipcRenderer.invoke("game:get-releases", forceRefresh),
    installLatest: (options: InstallDistributiveOptions) => ipcRenderer.invoke("game:install-latest", options),
    setActiveInstall: (installId: string) => ipcRenderer.invoke("game:set-active-install", installId),
    deleteInstall: (installId: string, options: DistributiveDeleteOptions) => ipcRenderer.invoke("game:delete-install", installId, options),
    getRuntimeState: () => ipcRenderer.invoke("game:get-runtime-state"),
    launchActiveInstall: (options?: GameLaunchOptions) => ipcRenderer.invoke("game:launch-active-install", options),
    stop: () => ipcRenderer.invoke("game:stop"),
    openInstallFolder: (installId: string) => ipcRenderer.invoke("game:open-install-folder", installId),
    openSavesFolder: (installId: string) => ipcRenderer.invoke("game:open-saves-folder", installId),
    createManualBackup: (options?: CreateManualBackupOptions): Promise<EBackupCreateResult> => ipcRenderer.invoke("game:create-manual-backup", options),
    restoreBackup: (backupId: string): Promise<EBackupRestoreResult> => ipcRenderer.invoke("game:restore-backup", backupId),
    deleteBackup: (backupId: string): Promise<EBackupDeleteResult> => ipcRenderer.invoke("game:delete-backup", backupId),
    renameBackup: (backupId: string, comment: string): Promise<EBackupRenameResult> => ipcRenderer.invoke("game:rename-backup", backupId, comment),
    onInstallProgress: (callback: (progress: InstallDistributiveProgress) => void) => {
        const listener = (_event: IpcRendererEvent, progress: InstallDistributiveProgress): void => callback(progress);
        ipcRenderer.on("game:install-progress", listener);
        return () => ipcRenderer.removeListener("game:install-progress", listener);
    },
    onRuntimeChanged: (callback: (runtime: GameRuntimeState) => void) => {
        const listener = (_event: IpcRendererEvent, runtime: GameRuntimeState): void => callback(runtime);
        ipcRenderer.on("game:runtime-changed", listener);
        return () => ipcRenderer.removeListener("game:runtime-changed", listener);
    },
    onSaveSummaryChanged: (callback: (update: GameSaveSummaryUpdate) => void) => {
        const listener = (_event: IpcRendererEvent, update: GameSaveSummaryUpdate): void => callback(update);
        ipcRenderer.on("game:save-summary-changed", listener);
        return () => ipcRenderer.removeListener("game:save-summary-changed", listener);
    },
    onSaveActivityChanged: (callback: (update: GameSaveActivityUpdate) => void) => {
        const listener = (_event: IpcRendererEvent, update: GameSaveActivityUpdate): void => callback(update);
        ipcRenderer.on("game:save-activity-changed", listener);
        return () => ipcRenderer.removeListener("game:save-activity-changed", listener);
    },
    onBackupProgress: (callback: (progress: BackupProgress) => void) => {
        const listener = (_event: IpcRendererEvent, progress: BackupProgress): void => callback(progress);
        ipcRenderer.on("game:backup-progress", listener);
        return () => ipcRenderer.removeListener("game:backup-progress", listener);
    },
    onBackupSummaryChanged: (callback: (update: BackupSummaryUpdate) => void) => {
        const listener = (_event: IpcRendererEvent, update: BackupSummaryUpdate): void => callback(update);
        ipcRenderer.on("game:backup-summary-changed", listener);
        return () => ipcRenderer.removeListener("game:backup-summary-changed", listener);
    }
};

const modsApi: ModsApi = {
    getState: () => ipcRenderer.invoke("mods:get-state"),
    installFromUrl: (url: string) => ipcRenderer.invoke("mods:install-from-url", url),
    checkUpdates: () => ipcRenderer.invoke("mods:check-updates"),
    update: (modId: string, options?: UpdateModOptions) => ipcRenderer.invoke("mods:update", modId, options),
    remove: (modId: string) => ipcRenderer.invoke("mods:remove", modId),
    openFolder: (modId?: string) => ipcRenderer.invoke("mods:open-folder", modId),
    onChanged: (callback: (event: ModRepositoryChangedEvent) => void) => {
        const listener = (_event: IpcRendererEvent, event: ModRepositoryChangedEvent): void => callback(event);
        ipcRenderer.on("mods:changed", listener);
        return () => ipcRenderer.removeListener("mods:changed", listener);
    },
    onNotice: (callback: (event: ModRepositoryNoticeEvent) => void) => {
        const listener = (_event: IpcRendererEvent, event: ModRepositoryNoticeEvent): void => callback(event);
        ipcRenderer.on("mods:notice", listener);
        return () => ipcRenderer.removeListener("mods:notice", listener);
    }
};

const api: AppApi = {
    updater: updaterApi,
    repository: repositoryApi,
    localization: localizationApi,
    appearance: appearanceApi,
    shell: shellApi,
    settings: settingsApi,
    game: gameApi,
    mods: modsApi
};

// Use `contextBridge` APIs to expose Electron APIs to renderer only if context isolation is enabled, otherwise just add to the DOM global.
if (process.contextIsolated) {
    console.log("Context isolated, exposing APIs...");
    try {
        contextBridge.exposeInMainWorld("electron", electronAPI);
        contextBridge.exposeInMainWorld("api", api);
    } catch (error) {
        console.error(error);
    }
} else {
    console.log("Context not isolated, adding APIs to global window...");
    window.electron = electronAPI;
    window.api = api;
}
