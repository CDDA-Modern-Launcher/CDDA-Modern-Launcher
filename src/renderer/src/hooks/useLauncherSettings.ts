import { useCallback, useEffect, useState } from "react";

import { type AutoBackupCooldown, type AutoBackupLimit, type BackupRotationLimit, DEFAULT_BACKUP_SETTINGS } from "../../../shared/backups";
import { DEFAULT_GAME_ASSET_VARIANT, type GameAssetVariant, type LauncherUserSettings } from "../../../shared/gameAssetVariants";

export type LauncherSettingsState = LauncherUserSettings & {
    setGameAssetVariant: (gameAssetVariant: GameAssetVariant) => Promise<void>;
    setBackupsEnabled: (backupsEnabled: boolean) => Promise<void>;
    setAutoBackupLimit: (autoBackupLimit: AutoBackupLimit) => Promise<void>;
    setAutoBackupCooldown: (autoBackupCooldown: AutoBackupCooldown) => Promise<void>;
    setManualBackupRotationLimit: (manualBackupRotationLimit: BackupRotationLimit) => Promise<void>;
};

const DEFAULT_LAUNCHER_SETTINGS: LauncherUserSettings = {
    gameAssetVariant: DEFAULT_GAME_ASSET_VARIANT,
    backupsEnabled: DEFAULT_BACKUP_SETTINGS.backupsEnabled,
    autoBackupLimit: DEFAULT_BACKUP_SETTINGS.autoBackupLimit,
    autoBackupCooldown: DEFAULT_BACKUP_SETTINGS.autoBackupCooldown,
    manualBackupRotationLimit: DEFAULT_BACKUP_SETTINGS.manualBackupRotationLimit
};

export function useLauncherSettings(): LauncherSettingsState {
    const [settings, setSettings] = useState<LauncherUserSettings>(DEFAULT_LAUNCHER_SETTINGS);

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

    const setGameAssetVariant = useCallback(async (gameAssetVariant: GameAssetVariant): Promise<void> => {
        setSettings(await window.api.settings.setGameAssetVariant(gameAssetVariant));
    }, []);

    const setBackupsEnabled = useCallback(async (backupsEnabled: boolean): Promise<void> => {
        setSettings(await window.api.settings.setBackupsEnabled(backupsEnabled));
    }, []);

    const setAutoBackupLimit = useCallback(async (autoBackupLimit: AutoBackupLimit): Promise<void> => {
        setSettings(await window.api.settings.setAutoBackupLimit(autoBackupLimit));
    }, []);

    const setAutoBackupCooldown = useCallback(async (autoBackupCooldown: AutoBackupCooldown): Promise<void> => {
        setSettings(await window.api.settings.setAutoBackupCooldown(autoBackupCooldown));
    }, []);

    const setManualBackupRotationLimit = useCallback(async (manualBackupRotationLimit: BackupRotationLimit): Promise<void> => {
        setSettings(await window.api.settings.setManualBackupRotationLimit(manualBackupRotationLimit));
    }, []);

    return { ...settings, setGameAssetVariant, setBackupsEnabled, setAutoBackupLimit, setAutoBackupCooldown, setManualBackupRotationLimit };
}
