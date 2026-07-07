import { create } from "zustand";
import { DEFAULT_RELEASE_ASSET_VARIANT } from "../../../shared/release-asset/DEFAULT_RELEASE_ASSET_VARIANT";
import { DEFAULT_BACKUP_SETTINGS } from "../../../shared/backups/DEFAULT_BACKUP_SETTINGS";
import { getErrorMessage } from "../../../shared/getErrorMessage";
import { SettingsIPC, SettingsIPCSetter } from "../../../shared/SettingsIPC";

interface ConfigState extends SettingsIPC, SettingsIPCSetter {
    isLoaded: boolean;
    isLoading: boolean;

    error: string | null;

    mount: () => () => void;
}

export const useConfigStore = create<ConfigState>()((set) => ({
    releaseAssetVariant: DEFAULT_RELEASE_ASSET_VARIANT,
    backupsEnabled: DEFAULT_BACKUP_SETTINGS.backupsEnabled,
    autoBackupLimit: DEFAULT_BACKUP_SETTINGS.autoBackupLimit,
    autoBackupCooldown: DEFAULT_BACKUP_SETTINGS.autoBackupCooldown,
    manualBackupRotationLimit: DEFAULT_BACKUP_SETTINGS.manualBackupRotationLimit,

    isLoaded: false,
    isLoading: false,
    error: null,

    mount: () => {
        set({ isLoading: true, error: null });

        void window.api.settings
            .get()
            .then((config) => {
                set({
                    ...config,
                    isLoaded: true,
                    isLoading: false
                });
            })
            .catch((error) => {
                set({
                    isLoading: false,
                    error: getErrorMessage(error)
                });

                console.error("Failed to load settings", error);
            });

        return window.api.settings.onChanged((config) => {
            set({
                ...config,
                isLoaded: true,
                isLoading: false,
                error: null
            });
        });
    },

    setReleaseAssetVariant: async (value) => {
        set({ error: null });
        try {
            const config = await window.api.settings.setReleaseAssetVariant(value);
            set(config);
            return config;
        } catch (e) {
            set({ error: getErrorMessage(e) });
            console.error("Failed to set release asset variant", e);
            throw e;
        }
    },

    setBackupsEnabled: async (value) => {
        set({ error: null });
        try {
            const config = await window.api.settings.setBackupsEnabled(value);
            set(config);
            return config;
        } catch (e) {
            set({ error: getErrorMessage(e) });
            console.error("Failed to set backups enabled", e);
            throw e;
        }
    },

    setAutoBackupLimit: async (value) => {
        set({ error: null });
        try {
            const config = await window.api.settings.setAutoBackupLimit(value);
            set(config);
            return config;
        } catch (e) {
            set({ error: getErrorMessage(e) });
            console.error("Failed to set auto backup limit", e);
            throw e;
        }
    },

    setAutoBackupCooldown: async (value) => {
        set({ error: null });
        try {
            const config = await window.api.settings.setAutoBackupCooldown(value);
            set(config);
            return config;
        } catch (e) {
            set({ error: getErrorMessage(e) });
            console.error("Failed to set auto backup cooldown", e);
            throw e;
        }
    },

    setManualBackupRotationLimit: async (value) => {
        set({ error: null });
        try {
            const config = await window.api.settings.setManualBackupRotationLimit(value);
            set(config);
            return config;
        } catch (e) {
            set({ error: getErrorMessage(e) });
            console.error("Failed to set manual backup rotation limit", e);
            throw e;
        }
    }
}));
