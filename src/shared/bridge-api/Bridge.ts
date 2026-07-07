export const Bridge = {
    Updater: {
        getState: "updater:get-state",
        checkNow: "updater:check-now",
        installNow: "updater:install-now",
        dismiss: "updater:dismiss",
        skipVersion: "updater:skip-version",
        showMockDownloadedUpdate: "updater:mock-downloaded",
        onStateChanged: "updater:state-changed"
    },
    Appearance: {
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
        getReleases: "game:get-releases",
        installLatest: "game:install-latest",
        setActiveInstall: "game:set-active-install",
        deleteInstall: "game:delete-install",
        getRuntimeState: "game:get-runtime-state",
        launchActiveInstall: "game:launch-active-install",
        stop: "game:stop",
        openInstallFolder: "game:open-install-folder",
        openSavesFolder: "game:open-saves-folder",
        createManualBackup: "game:create-manual-backup",
        restoreBackup: "game:restore-backup",
        deleteBackup: "game:delete-backup",
        renameBackup: "game:rename-backup",
        installProgress: "game:install-progress",
        runtimeChanged: "game:runtime-changed",
        saveSummaryChanged: "game:save-summary-changed",
        saveActivityChanged: "game:save-activity-changed",
        gameBackupProgress: "game:backup-progress",
        backupSummaryChanged: "game:backup-summary-changed"
    },
    Mods: {
        getState: "mods:get-state",
        installFromUrl: "mods:install-from-url",
        checkUpdates: "mods:check-updates",
        update: "mods:update",
        remove: "mods:remove",
        openFolder: "mods:open-folder",
        onChanged: "mods:changed",
        onNotice: "mods:notice"
    }
};
