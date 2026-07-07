import { IMountableState } from "@renderer/types/IMountableState";
import { create } from "zustand";
import { GameRuntimeState } from "../../../shared/GameRuntimeState";
import { useEffect } from "react";
import { subscribeWithSelector } from "zustand/middleware";

interface State extends IMountableState {
    runtimeState: GameRuntimeState;
}

export const useGameRuntimeStore = create<State>()(
    subscribeWithSelector((set) => ({
        runtimeState: { status: "idle" },

        mount: () => {
            window.api.game
                .getRuntimeState()
                .then((runtimeState) => set({ runtimeState }))
                .catch((error) => console.error("Failed to read game runtime", error));

            const unsubscribeRuntimeChanged = window.api.game.onRuntimeChanged((runtimeState) => set({ runtimeState }));

            return function cleanup() {
                unsubscribeRuntimeChanged();
            };
        }
    }))
);

export function useGameRuntimeStatusMount(): void {
    const mount = useGameRuntimeStore((state) => state.mount);
    useEffect(() => mount(), [mount]);
}

export function useIsGameRunning(): boolean {
    return useGameRuntimeStore((state) => state.runtimeState.status === "running");
}
