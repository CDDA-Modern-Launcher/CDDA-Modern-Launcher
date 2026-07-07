import { create } from "zustand";
import { IMountableState } from "@renderer/types/IMountableState";
import { GameBundleState } from "../../../shared/game-bundle/GameBundleState";
import { withSaveActivity } from "@renderer/utils/withSaveActivity";
import { withSaveSummary } from "@renderer/utils/withSaveSummary";
import { withBackupSummary } from "@renderer/utils/withBackupSummary";
import { toGameStateError } from "@renderer/utils/toGameStateError";

export interface GameStateStoreState extends IMountableState {
    state: GameBundleState;
    isCheckingLatest: boolean;
    load: () => Promise<void>;
    refresh: (refreshLatest?: boolean, forceRefresh?: boolean) => Promise<void>;
}

export const useGameStateStore = create<GameStateStoreState>()((set) => ({
    state: { status: "loading" },
    isCheckingLatest: false,

    mount: () => {
        const unsubscribeState = window.api.game.onStateChanged((state) => set({ state }));
        const unsubscribeBackups = window.api.game.onBackupSummaryChanged((update) => set((current) => ({ state: withBackupSummary(current.state, update.summary, update.gameBundleId) })));
        const unsubscribeSaves = window.api.game.onSaveSummaryChanged((update) => set((current) => ({ state: withSaveSummary(current.state, update.saves, update.gameBundleId) })));
        const unsubscribeSaveActivity = window.api.game.onSaveActivityChanged((update) => set((current) => ({ state: withSaveActivity(current.state, update.stable, update.gameBundleId) })));

        return function cleanup() {
            unsubscribeSaveActivity();
            unsubscribeSaves();
            unsubscribeBackups();
            unsubscribeState();
        };
    },

    load: async () => {
        set({ state: { status: "loading" }, isCheckingLatest: false });
        try {
            const localState = await window.api.game.getState({ refreshLatest: false });
            set({ state: localState });
            if (localState.status !== "ready") return;

            set({ isCheckingLatest: true });
            try {
                set({ state: await window.api.game.getState({ refreshLatest: true, forceRefresh: false }) });
            } catch (error) {
                set((current) => ({
                    state:
                        current.state.status === "ready"
                            ? { ...current.state, latestRelease: null, latestReleaseError: error instanceof Error ? error.message : String(error), updateAvailable: false }
                            : toGameStateError(error)
                }));
            } finally {
                set({ isCheckingLatest: false });
            }
        } catch (error) {
            set({ state: toGameStateError(error) });
        }
    },

    refresh: async (refreshLatest = true, forceRefresh = false) => {
        if (refreshLatest) set({ isCheckingLatest: true });
        try {
            set({ state: await window.api.game.getState({ refreshLatest, forceRefresh }) });
        } catch (error) {
            set({ state: toGameStateError(error) });
        } finally {
            if (refreshLatest) set({ isCheckingLatest: false });
        }
    }
}));
