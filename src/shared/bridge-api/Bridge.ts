export const Bridge = {
    Updater: {
        getState: "updater:get-state",
        checkNow: "updater:check-now",
        downloadNow: "updater:download-now",
        installNow: "updater:install-now",
        dismiss: "updater:dismiss",
        skipVersion: "updater:skip-version",
        onStateChanged: "updater:state-changed"
    },
    Appearance: {
        getInitialAppearance: "appearance:getInitialAppearance",
        getThemeSource: "appearance:getThemeSource",
        setThemeSource: "appearance:setThemeSource",
        getTheme: "appearance:getTheme",
        onAppearanceChanged: "appearance:onAppearanceChanged"
    },
    Settings: {
        get: "settings:get",
        changed: "settings:changed",
        setReleaseAssetVariant: "settings:set-release-asset-variant",
        setBackupsEnabled: "settings:set-backups-enabled",
        setAutoBackupLimit: "settings:set-auto-backup-limit",
        setAutoBackupCooldown: "settings:set-auto-backup-cooldown",
        setBackupRotationLimit: "settings:set-backup-rotation-limit"
    },
    Workspace: {
        getStatus: "workspace:get-status",
        setChannel: "workspace:set-channel",
        selectNewFolder: "workspace:select-new-folder"
    },
    Localization: {
        getBundle: "localization:get-bundle",
        setLocale: "localization:set-locale",
        onChanged: "localization:changed"
    },
    Shell: {
        openExternal: "shell:open-external"
    },
    Game: {
        getState: "game:get-state",
        stateChanged: "game:state-changed",
        getReleases: "game:get-releases",
        installLatestGameBundle: "game:install-latest-bundle",
        setActiveGameBundle: "game:set-active-bundle",
        deleteGameBundle: "game:delete-bundle",
        getRuntimeState: "game:get-runtime-state",
        launchActiveGameBundle: "game:launch-active-bundle",
        stop: "game:stop",
        openGameBundleFolder: "game:open-bundle-folder",
        openSavesFolder: "game:open-saves-folder",
        createManualBackup: "game:create-manual-backup",
        restoreBackup: "game:restore-backup",
        deleteBackup: "game:delete-backup",
        renameBackup: "game:rename-backup",
        getFileOperation: "game:get-file-operation",
        fileOperationChanged: "game:file-operation-changed",
        gameBundleInstallProgress: "game:bundle-install-progress",
        runtimeChanged: "game:runtime-changed",
        saveSummaryChanged: "game:save-summary-changed",
        saveActivityChanged: "game:save-activity-changed",
        gameBackupProgress: "game:backup-progress",
        backupSummaryChanged: "game:backup-summary-changed"
    },
    Mods: {
        getState: "mods:get-state",
        discoverFromGit: "mods:discover-from-git",
        discoverFromArchive: "mods:discover-from-archive",
        installFromFolder: "mods:install-from-folder",
        installSelection: "mods:install-selection",
        checkUpdates: "mods:check-updates",
        update: "mods:update",
        remove: "mods:remove",
        openFolder: "mods:open-folder",
        onChanged: "mods:changed",
        onNotice: "mods:notice"
    }
} as const;

type DeepValueOf<T> = T extends string ? T : T extends Record<string, unknown> ? DeepValueOf<T[keyof T]> : never;

export type BridgeChannel = DeepValueOf<typeof Bridge>;
