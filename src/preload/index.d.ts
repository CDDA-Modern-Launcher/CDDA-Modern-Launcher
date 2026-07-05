import { ElectronAPI } from "@electron-toolkit/preload";

import { AppAppearance, AppTheme } from "../shared/appearance";
import {
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
import { GameAssetVariant, LauncherUserSettings } from "../shared/gameAssetVariants";
import {
    CreateManualBackupOptions,
    DeleteGameInstallOptions,
    DeleteGameInstallResult,
    GameInstallProgress,
    GameInstallState,
    GameRelease,
    GameRuntimeState,
    GameSaveActivityUpdate,
    GameSaveSummaryUpdate,
    InstallGameOptions,
    InstallGameResult,
    LaunchGameOptions,
    LaunchGameResult,
    OpenGameFolderResult,
    SetActiveGameInstallResult,
    StopGameResult
} from "../shared/gameInstallations";
import { LocalizationBundle } from "../shared/localization";
import { CheckModsResult, InstallModResult, ModRepositoryChangedEvent, ModRepositoryNoticeEvent, ModRepositoryState, OpenModFolderResult, RemoveModResult, UpdateModOptions, UpdateModResult } from "../shared/modRepository";
import { RepositoryStatus, SelectRepositoryResult } from "../shared/repository";

type UpdateState =
    | { status: "idle" }
    | { status: "checking" }
    | { status: "available"; version: string }
    | { status: "downloading"; version: string; percent: number }
    | { status: "downloaded"; version: string }
    | { status: "not-available"; version?: string }
    | { status: "skipped"; version: string }
    | { status: "error"; message: string; messageKey?: string };

type UpdaterApi = {
    getState: () => Promise<UpdateState>;
    checkNow: () => Promise<UpdateState>;
    installNow: () => Promise<boolean>;
    dismiss: () => Promise<UpdateState>;
    skipVersion: (version: string) => Promise<UpdateState>;
    showMockDownloadedUpdate: (version?: string) => Promise<UpdateState>;
    onStateChanged: (callback: (state: UpdateState) => void) => () => void;
};

type RepositoryApi = {
    getStatus: () => Promise<RepositoryStatus>;
    selectFolder: () => Promise<SelectRepositoryResult>;
    setSelectedChannel: (channelId: string) => Promise<RepositoryStatus>;
};

type LocalizationApi = {
    getBundle: () => Promise<LocalizationBundle>;
    setLocale: (locale: string) => Promise<LocalizationBundle>;
    onChanged: (callback: (bundle: LocalizationBundle) => void) => () => void;
};

type AppearanceApi = {
    getInitial: () => AppAppearance;
    get: () => Promise<AppAppearance>;
    setTheme: (theme: AppTheme) => Promise<AppAppearance>;
    onChanged: (callback: (appearance: AppAppearance) => void) => () => void;
};

type ShellApi = {
    openExternal: (url: string) => Promise<boolean>;
};

type SettingsApi = {
    get: () => Promise<LauncherUserSettings>;
    setGameAssetVariant: (gameAssetVariant: GameAssetVariant) => Promise<LauncherUserSettings>;
    setBackupsEnabled: (backupsEnabled: boolean) => Promise<LauncherUserSettings>;
    setAutoBackupLimit: (autoBackupLimit: AutoBackupLimit) => Promise<LauncherUserSettings>;
    setAutoBackupCooldown: (autoBackupCooldown: AutoBackupCooldown) => Promise<LauncherUserSettings>;
    setManualBackupRotationLimit: (manualBackupRotationLimit: BackupRotationLimit) => Promise<LauncherUserSettings>;
    onChanged: (callback: (settings: LauncherUserSettings) => void) => () => void;
};

type GameStateRequest = boolean | { refreshLatest?: boolean; forceRefresh?: boolean };

type GameApi = {
    getState: (options?: GameStateRequest) => Promise<GameInstallState>;
    getReleases: (forceRefresh?: boolean) => Promise<GameRelease[]>;
    installLatest: (options: InstallGameOptions) => Promise<InstallGameResult>;
    setActiveInstall: (installId: string) => Promise<SetActiveGameInstallResult>;
    deleteInstall: (installId: string, options: DeleteGameInstallOptions) => Promise<DeleteGameInstallResult>;
    getRuntimeState: () => Promise<GameRuntimeState>;
    launchActiveInstall: (options?: LaunchGameOptions) => Promise<LaunchGameResult>;
    stop: () => Promise<StopGameResult>;
    openInstallFolder: (installId: string) => Promise<OpenGameFolderResult>;
    openSavesFolder: (installId: string) => Promise<OpenGameFolderResult>;
    createManualBackup: (options?: CreateManualBackupOptions) => Promise<CreateGameBackupResult>;
    restoreBackup: (backupId: string) => Promise<RestoreGameBackupResult>;
    deleteBackup: (backupId: string) => Promise<DeleteGameBackupResult>;
    renameBackup: (backupId: string, comment: string) => Promise<RenameGameBackupResult>;
    onInstallProgress: (callback: (progress: GameInstallProgress) => void) => () => void;
    onRuntimeChanged: (callback: (runtime: GameRuntimeState) => void) => () => void;
    onSaveSummaryChanged: (callback: (update: GameSaveSummaryUpdate) => void) => () => void;
    onSaveActivityChanged: (callback: (update: GameSaveActivityUpdate) => void) => () => void;
    onBackupProgress: (callback: (progress: GameBackupProgress) => void) => () => void;
    onBackupSummaryChanged: (callback: (update: GameBackupSummaryUpdate) => void) => () => void;
};

type ModsApi = {
    getState: () => Promise<ModRepositoryState>;
    installFromUrl: (url: string) => Promise<InstallModResult>;
    checkUpdates: () => Promise<CheckModsResult>;
    update: (modId: string, options?: UpdateModOptions) => Promise<UpdateModResult>;
    remove: (modId: string) => Promise<RemoveModResult>;
    openFolder: (modId?: string) => Promise<OpenModFolderResult>;
    onChanged: (callback: (event: ModRepositoryChangedEvent) => void) => () => void;
    onNotice: (callback: (event: ModRepositoryNoticeEvent) => void) => () => void;
};

type AppApi = {
    updater: UpdaterApi;
    repository: RepositoryApi;
    localization: LocalizationApi;
    appearance: AppearanceApi;
    shell: ShellApi;
    settings: SettingsApi;
    game: GameApi;
    mods: ModsApi;
};

declare global {
    interface Window {
        electron: ElectronAPI;
        api: AppApi;
    }
}
