import { electronAPI } from "@electron-toolkit/preload";
import type { IpcRendererEvent } from "electron";
import { contextBridge, ipcRenderer } from "electron";

import { AppAppearance, AppTheme } from "../shared/appearance";
import type {
    AutoBackupCooldown,
    AutoBackupLimit,
    BackupRotationLimit,
    CreateGameBackupResult,
    DeleteGameBackupResult,
    GameBackupProgress,
    GameBackupSummaryUpdate,
    RenameGameBackupResult,
    RestoreGameBackupResult
} from "../shared/backups";
import type { GameAssetVariant, LauncherUserSettings } from "../shared/gameAssetVariants";
import {
    CreateManualBackupOptions,
    DeleteGameInstallOptions,
    GameInstallProgress,
    GameRuntimeState,
    GameSaveActivityUpdate,
    GameSaveSummaryUpdate,
    InstallGameOptions,
    LaunchGameOptions
} from "../shared/gameInstallations";
import { LocalizationBundle } from "../shared/localization";
import { ModRepositoryChangedEvent, ModRepositoryNoticeEvent, UpdateModOptions } from "../shared/modRepository";
import { RepositoryStatus, SelectRepositoryResult } from "../shared/repository";

const updaterApi = {
    getState: () => ipcRenderer.invoke("updater:get-state"),
    checkNow: () => ipcRenderer.invoke("updater:check-now"),
    installNow: () => ipcRenderer.invoke("updater:install-now"),
    dismiss: () => ipcRenderer.invoke("updater:dismiss"),
    skipVersion: (version: string) => ipcRenderer.invoke("updater:skip-version", version),
    showMockDownloadedUpdate: (version?: string) => ipcRenderer.invoke("updater:mock-downloaded", version),
    onStateChanged: (callback: (state: unknown) => void) => {
        const listener = (_event: IpcRendererEvent, state: unknown): void => callback(state);

        ipcRenderer.on("updater:state-changed", listener);

        return () => {
            ipcRenderer.removeListener("updater:state-changed", listener);
        };
    }
};

const repositoryApi = {
    getStatus: (): Promise<RepositoryStatus> => ipcRenderer.invoke("repository:get-status"),
    selectFolder: (): Promise<SelectRepositoryResult> => ipcRenderer.invoke("repository:select-folder"),
    setSelectedChannel: (channelId: string): Promise<RepositoryStatus> => ipcRenderer.invoke("repository:set-selected-channel", channelId)
};

const localizationApi = {
    getBundle: (): Promise<LocalizationBundle> => ipcRenderer.invoke("localization:get-bundle"),
    setLocale: (locale: string): Promise<LocalizationBundle> => ipcRenderer.invoke("localization:set-locale", locale),
    onChanged: (callback: (bundle: LocalizationBundle) => void) => {
        const listener = (_event: IpcRendererEvent, bundle: LocalizationBundle): void => callback(bundle);

        ipcRenderer.on("localization:changed", listener);

        return () => {
            ipcRenderer.removeListener("localization:changed", listener);
        };
    }
};

const appearanceApi = {
    getInitial: (): AppAppearance => ipcRenderer.sendSync("appearance:get-sync"),
    get: (): Promise<AppAppearance> => ipcRenderer.invoke("appearance:get"),
    setTheme: (theme: AppTheme): Promise<AppAppearance> => ipcRenderer.invoke("appearance:set-theme", theme),
    onChanged: (callback: (appearance: AppAppearance) => void) => {
        const listener = (_event: IpcRendererEvent, appearance: AppAppearance): void => callback(appearance);

        ipcRenderer.on("appearance:changed", listener);

        return () => {
            ipcRenderer.removeListener("appearance:changed", listener);
        };
    }
};

const shellApi = {
    openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke("shell:open-external", url)
};

const settingsApi = {
    get: (): Promise<LauncherUserSettings> => ipcRenderer.invoke("settings:get"),
    setGameAssetVariant: (gameAssetVariant: GameAssetVariant): Promise<LauncherUserSettings> => ipcRenderer.invoke("settings:set-game-asset-variant", gameAssetVariant),
    setBackupsEnabled: (backupsEnabled: boolean): Promise<LauncherUserSettings> => ipcRenderer.invoke("settings:set-backups-enabled", backupsEnabled),
    setAutoBackupLimit: (autoBackupLimit: AutoBackupLimit): Promise<LauncherUserSettings> => ipcRenderer.invoke("settings:set-auto-backup-limit", autoBackupLimit),
    setAutoBackupCooldown: (autoBackupCooldown: AutoBackupCooldown): Promise<LauncherUserSettings> => ipcRenderer.invoke("settings:set-auto-backup-cooldown", autoBackupCooldown),
    setManualBackupRotationLimit: (manualBackupRotationLimit: BackupRotationLimit): Promise<LauncherUserSettings> => ipcRenderer.invoke("settings:set-manual-backup-rotation-limit", manualBackupRotationLimit),
    onChanged: (callback: (settings: LauncherUserSettings) => void) => {
        const listener = (_event: IpcRendererEvent, settings: LauncherUserSettings): void => callback(settings);

        ipcRenderer.on("settings:changed", listener);

        return () => {
            ipcRenderer.removeListener("settings:changed", listener);
        };
    }
};

const gameApi = {
    getState: (options?: boolean | { refreshLatest?: boolean; forceRefresh?: boolean }) => ipcRenderer.invoke("game:get-state", options),
    getReleases: (forceRefresh?: boolean) => ipcRenderer.invoke("game:get-releases", forceRefresh),
    installLatest: (options: InstallGameOptions) => ipcRenderer.invoke("game:install-latest", options),
    setActiveInstall: (installId: string) => ipcRenderer.invoke("game:set-active-install", installId),
    deleteInstall: (installId: string, options: DeleteGameInstallOptions) => ipcRenderer.invoke("game:delete-install", installId, options),
    getRuntimeState: () => ipcRenderer.invoke("game:get-runtime-state"),
    launchActiveInstall: (options?: LaunchGameOptions) => ipcRenderer.invoke("game:launch-active-install", options),
    stop: () => ipcRenderer.invoke("game:stop"),
    openInstallFolder: (installId: string) => ipcRenderer.invoke("game:open-install-folder", installId),
    openSavesFolder: (installId: string) => ipcRenderer.invoke("game:open-saves-folder", installId),
    createManualBackup: (options?: CreateManualBackupOptions): Promise<CreateGameBackupResult> => ipcRenderer.invoke("game:create-manual-backup", options),
    restoreBackup: (backupId: string): Promise<RestoreGameBackupResult> => ipcRenderer.invoke("game:restore-backup", backupId),
    deleteBackup: (backupId: string): Promise<DeleteGameBackupResult> => ipcRenderer.invoke("game:delete-backup", backupId),
    renameBackup: (backupId: string, comment: string): Promise<RenameGameBackupResult> => ipcRenderer.invoke("game:rename-backup", backupId, comment),
    onInstallProgress: (callback: (progress: GameInstallProgress) => void) => {
        const listener = (_event: IpcRendererEvent, progress: GameInstallProgress): void => callback(progress);

        ipcRenderer.on("game:install-progress", listener);

        return () => {
            ipcRenderer.removeListener("game:install-progress", listener);
        };
    },
    onRuntimeChanged: (callback: (runtime: GameRuntimeState) => void) => {
        const listener = (_event: IpcRendererEvent, runtime: GameRuntimeState): void => callback(runtime);

        ipcRenderer.on("game:runtime-changed", listener);

        return () => {
            ipcRenderer.removeListener("game:runtime-changed", listener);
        };
    },
    onSaveSummaryChanged: (callback: (update: GameSaveSummaryUpdate) => void) => {
        const listener = (_event: IpcRendererEvent, update: GameSaveSummaryUpdate): void => callback(update);

        ipcRenderer.on("game:save-summary-changed", listener);

        return () => {
            ipcRenderer.removeListener("game:save-summary-changed", listener);
        };
    },
    onSaveActivityChanged: (callback: (update: GameSaveActivityUpdate) => void) => {
        const listener = (_event: IpcRendererEvent, update: GameSaveActivityUpdate): void => callback(update);

        ipcRenderer.on("game:save-activity-changed", listener);

        return () => {
            ipcRenderer.removeListener("game:save-activity-changed", listener);
        };
    },
    onBackupProgress: (callback: (progress: GameBackupProgress) => void) => {
        const listener = (_event: IpcRendererEvent, progress: GameBackupProgress): void => callback(progress);

        ipcRenderer.on("game:backup-progress", listener);

        return () => {
            ipcRenderer.removeListener("game:backup-progress", listener);
        };
    },
    onBackupSummaryChanged: (callback: (update: GameBackupSummaryUpdate) => void) => {
        const listener = (_event: IpcRendererEvent, update: GameBackupSummaryUpdate): void => callback(update);

        ipcRenderer.on("game:backup-summary-changed", listener);

        return () => {
            ipcRenderer.removeListener("game:backup-summary-changed", listener);
        };
    }
};

const modsApi = {
    getState: () => ipcRenderer.invoke("mods:get-state"),
    installFromUrl: (url: string) => ipcRenderer.invoke("mods:install-from-url", url),
    checkUpdates: () => ipcRenderer.invoke("mods:check-updates"),
    update: (modId: string, options?: UpdateModOptions) => ipcRenderer.invoke("mods:update", modId, options),
    remove: (modId: string) => ipcRenderer.invoke("mods:remove", modId),
    openFolder: (modId?: string) => ipcRenderer.invoke("mods:open-folder", modId),
    onChanged: (callback: (event: ModRepositoryChangedEvent) => void) => {
        const listener = (_event: IpcRendererEvent, event: ModRepositoryChangedEvent): void => callback(event);

        ipcRenderer.on("mods:changed", listener);

        return () => {
            ipcRenderer.removeListener("mods:changed", listener);
        };
    },
    onNotice: (callback: (event: ModRepositoryNoticeEvent) => void) => {
        const listener = (_event: IpcRendererEvent, event: ModRepositoryNoticeEvent): void => callback(event);

        ipcRenderer.on("mods:notice", listener);

        return () => {
            ipcRenderer.removeListener("mods:notice", listener);
        };
    }
};

// Custom APIs for renderer
const api = {
    updater: updaterApi,
    repository: repositoryApi,
    localization: localizationApi,
    appearance: appearanceApi,
    shell: shellApi,
    settings: settingsApi,
    game: gameApi,
    mods: modsApi
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld("electron", electronAPI);
        contextBridge.exposeInMainWorld("api", api);
    } catch (error) {
        console.error(error);
    }
} else {
    // @ts-ignore (define in dts)
    window.electron = electronAPI;
    // @ts-ignore (define in dts)
    window.api = api;
}
