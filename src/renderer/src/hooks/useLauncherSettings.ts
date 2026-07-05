import { useCallback, useEffect, useState } from "react";

import { DEFAULT_GAME_ASSET_VARIANT, type GameAssetVariant, type LauncherUserSettings } from "../../../shared/gameAssetVariants";

export type LauncherSettingsState = LauncherUserSettings & {
    setGameAssetVariant: (gameAssetVariant: GameAssetVariant) => Promise<void>;
};

const DEFAULT_LAUNCHER_SETTINGS: LauncherUserSettings = {
    gameAssetVariant: DEFAULT_GAME_ASSET_VARIANT
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

    return { ...settings, setGameAssetVariant };
}
