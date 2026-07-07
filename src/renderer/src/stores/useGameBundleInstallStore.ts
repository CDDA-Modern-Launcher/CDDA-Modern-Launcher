import { create } from "zustand";
import { IMountableState } from "@renderer/types/IMountableState";
import { GameBundleDeleteOptions } from "../../../shared/game-bundle/GameBundleDeleteOptions";
import { GameBundleInstallOptions } from "../../../shared/game-bundle/GameBundleInstallOptions";
import { GameBundleInstallProgress } from "../../../shared/game-bundle/GameBundleInstallProgress";
import { isGameBundleInstallRunning } from "@renderer/utils/isGameBundleInstallRunning";

interface GameBundleInstallStoreState extends IMountableState {
    progress: GameBundleInstallProgress;
    isInstalling: boolean;
    installLatest: (options: GameBundleInstallOptions) => Promise<boolean>;
    setActive: (gameBundleId: string) => Promise<boolean>;
    delete: (gameBundleId: string, options: GameBundleDeleteOptions) => Promise<boolean>;
}

export const useGameBundleInstallStore = create<GameBundleInstallStoreState>()((set) => ({
    progress: { status: "idle" },
    isInstalling: false,

    mount: () => window.api.game.onGameBundleInstallProgress((progress) => set({ progress })),

    installLatest: async (options) => {
        set({ isInstalling: true });
        try {
            const result = await window.api.game.installLatestGameBundle(options);
            if (result.status === "installed") return true;
            console.error("Failed to install game bundle", result.message);
            return false;
        } finally {
            set({ isInstalling: false });
        }
    },

    setActive: async (gameBundleId) => {
        const result = await window.api.game.setActiveGameBundle(gameBundleId);
        if (result.status === "updated") return true;
        console.error("Failed to set active game bundle", result.message);
        return false;
    },

    delete: async (gameBundleId, options) => {
        const result = await window.api.game.deleteGameBundle(gameBundleId, options);
        if (result.status === "deleted") return true;
        console.error("Failed to delete game bundle", result.message);
        return false;
    }
}));

export function selectIsGameBundleInstallRunning(state: Pick<GameBundleInstallStoreState, "isInstalling" | "progress">): boolean {
    return isGameBundleInstallRunning(state.isInstalling, state.progress);
}
