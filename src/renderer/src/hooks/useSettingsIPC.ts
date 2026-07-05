import { useCallback, useEffect, useState } from "react";

import { TBackupRotationLimit } from "../../../shared/backups/types/TBackupRotationLimit";
import { TAutoBackupLimit } from "../../../shared/backups/types/TAutoBackupLimit";
import { TAutoBackupCooldown } from "../../../shared/backups/types/TAutoBackupCooldown";
import { DEFAULT_BACKUP_SETTINGS } from "../../../shared/backups/DEFAULT_BACKUP_SETTINGS";
import { TReleaseAssetVariant } from "../../../shared/release-asset/TReleaseAssetVariant";
import { DEFAULT_RELEASE_ASSET_VARIANT } from "../../../shared/release-asset/DEFAULT_RELEASE_ASSET_VARIANT";
import { SettingsIPC } from "../../../shared/SettingsIPC";

export type LauncherSettingsState = SettingsIPC & {
    setGameAssetVariant: (gameAssetVariant: TReleaseAssetVariant) => Promise<void>;
    setBackupsEnabled: (backupsEnabled: boolean) => Promise<void>;
    setAutoBackupLimit: (autoBackupLimit: TAutoBackupLimit) => Promise<void>;
    setAutoBackupCooldown: (autoBackupCooldown: TAutoBackupCooldown) => Promise<void>;
    setManualBackupRotationLimit: (manualBackupRotationLimit: TBackupRotationLimit) => Promise<void>;
};

const DEFAULT_LAUNCHER_SETTINGS: SettingsIPC = {
    releaseAssetVariant: DEFAULT_RELEASE_ASSET_VARIANT,
    backupsEnabled: DEFAULT_BACKUP_SETTINGS.backupsEnabled,
    autoBackupLimit: DEFAULT_BACKUP_SETTINGS.autoBackupLimit,
    autoBackupCooldown: DEFAULT_BACKUP_SETTINGS.autoBackupCooldown,
    manualBackupRotationLimit: DEFAULT_BACKUP_SETTINGS.manualBackupRotationLimit
};

export function useSettingsIPC(): LauncherSettingsState {
    const [settings, setSettings] = useState<SettingsIPC>(DEFAULT_LAUNCHER_SETTINGS);

    useEffect(() => {
        let mounted = true;

        window.api.settings.get().then((initialSettings) => {
            if (mounted) {
                setSettings(initialSettings);
            }
        });

        const unsubscribe = window.api.settings.onChanged(setSettings);

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    const setGameAssetVariant = useCallback(async (gameAssetVariant: TReleaseAssetVariant): Promise<void> => {
        setSettings(await window.api.settings.setGameAssetVariant(gameAssetVariant));
    }, []);

    const setBackupsEnabled = useCallback(async (backupsEnabled: boolean): Promise<void> => {
        setSettings(await window.api.settings.setBackupsEnabled(backupsEnabled));
    }, []);

    const setAutoBackupLimit = useCallback(async (autoBackupLimit: TAutoBackupLimit): Promise<void> => {
        setSettings(await window.api.settings.setAutoBackupLimit(autoBackupLimit));
    }, []);

    const setAutoBackupCooldown = useCallback(async (autoBackupCooldown: TAutoBackupCooldown): Promise<void> => {
        setSettings(await window.api.settings.setAutoBackupCooldown(autoBackupCooldown));
    }, []);

    const setManualBackupRotationLimit = useCallback(async (manualBackupRotationLimit: TBackupRotationLimit): Promise<void> => {
        setSettings(await window.api.settings.setManualBackupRotationLimit(manualBackupRotationLimit));
    }, []);

    return { ...settings, setGameAssetVariant, setBackupsEnabled, setAutoBackupLimit, setAutoBackupCooldown, setManualBackupRotationLimit };
}
