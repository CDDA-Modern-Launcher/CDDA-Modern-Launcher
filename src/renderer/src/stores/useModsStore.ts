import { create } from "zustand";
import { ModRepositoryState } from "../../../shared/mods/ModRepositoryState";
import { IMountableState } from "@renderer/types/IMountableState";
import { ModInstanceInfo } from "../../../shared/mods/ModInstanceInfo";
import { translate } from "@renderer/stores/useLocaleStore";
import { EModDiscoveryResult } from "../../../shared/mods/EModDiscoveryResult";

export type TModsBusyAction = null | "install" | "check-updates" | "update" | "remove";

interface State extends IMountableState {
    error: string | null;
    setError: (error: string | null) => void;
    busyAction: TModsBusyAction;
    busyModId: string | null;
    state: ModRepositoryState;
    checkUpdates: () => Promise<void>;
    update: (mod: ModInstanceInfo, force?: boolean) => Promise<void>;
    remove: (mod: ModInstanceInfo) => Promise<void>;
    discoverFromGit: (gitUrl: string) => Promise<EModDiscoveryResult>;
    discoverFromArchive: () => Promise<EModDiscoveryResult>;
    installFromFolder: () => Promise<boolean>;
    installSelection: (sessionId: string, modIds: string[]) => Promise<boolean>;
    openFolder: (mod: ModInstanceInfo) => Promise<void>;
}

export const useModsStore = create<State>((set) => ({
    error: null,
    setError: (error) => set({ error }),
    busyAction: null,
    busyModId: null,
    state: { status: "unconfigured", mods: [], checking: false },

    checkUpdates: async () => {
        set({ busyAction: "check-updates", error: null });
        try {
            const result = await window.api.mods.checkUpdates();
            set({ state: result.state, error: result.status === "error" ? result.message : null });
        } finally {
            set({ busyAction: null });
        }
    },

    update: async (mod, force) => {
        set({ busyAction: "update", busyModId: mod.id, error: null });
        try {
            const result = await window.api.mods.update(mod.id, { force });
            set({ state: result.state });
            if (result.status === "blocked-by-local-changes") set({ error: translate("content.sheet.mods.update.blocked.description", { name: result.mod.displayName }) });
            else if (result.status === "error") set({ error: result.message });
        } finally {
            set({ busyAction: null, busyModId: null });
        }
    },

    remove: async (mod) => {
        set({ busyAction: "remove", busyModId: mod.id, error: null });
        try {
            const result = await window.api.mods.remove(mod.id);
            set({ state: result.state, error: result.status === "error" ? result.message : null });
        } finally {
            set({ busyAction: null, busyModId: null });
        }
    },

    discoverFromGit: async (gitUrl) => {
        set({ busyAction: "install", error: null });
        try {
            const result = await window.api.mods.discoverFromGit(gitUrl);
            set({ state: result.state });
            if (result.status === "error") set({ error: result.message });
            return result;
        } finally {
            set({ busyAction: null });
        }
    },

    discoverFromArchive: async () => {
        set({ busyAction: "install", error: null });
        try {
            const result = await window.api.mods.discoverFromArchive();
            set({ state: result.state });
            if (result.status === "error") set({ error: result.message });
            return result;
        } finally {
            set({ busyAction: null });
        }
    },

    installFromFolder: async () => {
        set({ busyAction: "install", error: null });
        try {
            const result = await window.api.mods.installFromFolder();
            set({ state: result.state });
            if (result.status === "error") {
                set({ error: result.message });
                return false;
            }
            return result.status === "installed";
        } finally {
            set({ busyAction: null });
        }
    },

    installSelection: async (sessionId, modIds) => {
        set({ busyAction: "install", error: null });
        try {
            const result = await window.api.mods.installSelection({ sessionId, modIds });
            set({ state: result.state });
            if (result.status === "error") {
                set({ error: result.message });
                return false;
            }
            return true;
        } finally {
            set({ busyAction: null });
        }
    },

    openFolder: async (mod) => {
        const result = await window.api.mods.openFolder(mod.id);
        if (result.status === "error") set({ error: result.message });
    },

    mount: () => {
        void window.api.mods.getState().then((state) => set({ state }));
        const unsubscribeChanged = window.api.mods.onChanged((event) => set({ state: event.state }));
        const unsubscribeNotice = window.api.mods.onNotice((event) => set({ state: event.state }));
        return () => {
            unsubscribeChanged();
            unsubscribeNotice();
        };
    }
}));
