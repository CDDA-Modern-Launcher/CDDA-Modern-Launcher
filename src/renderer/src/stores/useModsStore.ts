import { create } from "zustand";
import { ModRepositoryState } from "../../../shared/mods/ModRepositoryState";
import { IMountableState } from "@renderer/types/IMountableState";
import { ModInstanceInfo } from "../../../shared/mods/ModInstanceInfo";
import { translate } from "@renderer/stores/useLocaleStore";

type TBusyAction = null | "install" | "check-updates" | "update" | "remove";

interface State extends IMountableState {
    error: string | null;
    setError: (error: string | null) => void;

    busyAction: TBusyAction;
    setBusyAction: (busyAction: TBusyAction) => void;

    busyModId: string | null;

    state: ModRepositoryState;
    setState: (state: ModRepositoryState) => void;

    checkUpdates: () => Promise<void>;

    update: (mod: ModInstanceInfo, force?: boolean) => Promise<void>;
    remove: (mod: ModInstanceInfo) => Promise<void>;
    installModFromGit: (gitUrl: string) => Promise<boolean>;
    openFolder: (mod: ModInstanceInfo) => Promise<void>;
}

export const useModsStore = create<State>((set) => ({
    error: null,
    setError: (error: string | null) => {
        set({ error });
    },

    busyAction: null,
    setBusyAction: (busyAction: TBusyAction) => set({ busyAction }),

    busyModId: null,

    state: { status: "unconfigured", mods: [], checking: false },
    setState: (state: ModRepositoryState) => set({ state }),

    checkUpdates: async () => {
        set({ busyAction: "check-updates", error: null });
        try {
            const result = await window.api.mods.checkUpdates();
            set({ state: result.state });
            if (result.status !== "checked") {
                set({ error: result.message });
            }
        } finally {
            set({ busyAction: null });
        }
    },

    update: async (mod: ModInstanceInfo, force?: boolean) => {
        set({ busyAction: "update", busyModId: mod.id, error: null });
        try {
            const result = await window.api.mods.update(mod.id, { force });
            set({ state: result.state });

            switch (result.status) {
                case "updated":
                    break;
                case "blocked-by-local-changes":
                    set({ error: translate("content.sheet.mods.update.blocked.description", { name: result.mod.displayName }) });
                    break;
                default:
                    set({ error: result.message });
                    break;
            }
        } finally {
            set({ busyAction: null, busyModId: null });
        }
    },

    remove: async (mod: ModInstanceInfo) => {
        set({ busyAction: "remove", busyModId: mod.id, error: null });
        try {
            const result = await window.api.mods.remove(mod.id);
            set({ state: result.state });

            switch (result.status) {
                case "deleted":
                    break;
                default:
                    set({ error: result.message });
                    break;
            }
        } finally {
            set({ busyAction: null, busyModId: null });
        }
    },

    openFolder: async (mod: ModInstanceInfo) => {
        const result = await window.api.mods.openFolder(mod.id);
        if (result.status === "error") {
            set({ error: result.message });
        }
    },

    installModFromGit: async (gitUrl: string) => {
        set({ busyAction: "install", error: null });
        try {
            const result = await window.api.mods.installFromUrl(gitUrl);
            set({ state: result.state });

            switch (result.status) {
                case "installed":
                    return true;
                case "error":
                    set({ error: result.message });
                    return false;
            }
        } finally {
            set({ busyAction: null });
        }
    },

    mount: () => {
        void window.api.mods.getState().then((state) => set({ state }));

        const unsubscribeChanged = window.api.mods.onChanged((event) => set({ state: event.state }));
        const unsubscribeNotice = window.api.mods.onNotice((event) => set({ state: event.state }));

        return function cleanup() {
            unsubscribeChanged();
            unsubscribeNotice();
        };
    }
}));
