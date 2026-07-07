import { create } from "zustand";
import { ModRepositoryState } from "../../../shared/mods/ModRepositoryState";
import { ModRepositoryNoticeEvent } from "../../../shared/mods/ModRepositoryNoticeEvent";

type TBusyAction = null | "install";

interface State {
    error: string | null;
    setError: (error: string | null) => void;

    busyAction: TBusyAction;
    setBusyAction: (busyAction: TBusyAction) => void;

    state: ModRepositoryState;
    setState: (state: ModRepositoryState) => void;

    installModFromGit: (gitUrl: string) => Promise<boolean>;

    mount: () => () => void;
}

export const useModsSheetStore = create<State>((set) => ({
    error: null,
    setError: (error: string | null) => {
        set({ error });
    },

    busyAction: null,
    setBusyAction: (busyAction: TBusyAction) => set({ busyAction }),

    state: { status: "unconfigured", mods: [], checking: false },
    setState: (state: ModRepositoryState) => set({ state }),

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
        void window.api.mods.getState().then((nextState) => {
            set({ state: nextState });
        });
        const unsubscribeChanged = window.api.mods.onChanged((event) => {
            set({ state: event.state });
        });
        const unsubscribeNotice = window.api.mods.onNotice((event: ModRepositoryNoticeEvent) => {
            set({ state: event.state });
        });
        return function cleanup() {
            unsubscribeChanged();
            unsubscribeNotice();
        };
    }
}));
