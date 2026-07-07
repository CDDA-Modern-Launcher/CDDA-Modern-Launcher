import { create } from "zustand";
import { GameLaunchOptions } from "../../../shared/launch/GameLaunchOptions";

interface GameCommandStoreState {
    launchActive: (options?: GameLaunchOptions) => Promise<boolean>;
    stop: () => Promise<boolean>;
}

export const useGameCommandStore = create<GameCommandStoreState>()(() => ({
    launchActive: async (options = {}) => {
        const result = await window.api.game.launchActiveGameBundle(options);
        if (result.status === "launched" || result.status === "already-running") return true;
        console.error("Failed to launch game", result.message);
        return false;
    },

    stop: async () => {
        const result = await window.api.game.stop();
        if (result.status === "stopped" || result.status === "not-running") return true;
        console.error("Failed to stop game", result.message);
        return false;
    }
}));
