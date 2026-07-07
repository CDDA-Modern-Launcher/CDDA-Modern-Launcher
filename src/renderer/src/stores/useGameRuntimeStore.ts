import { IMountableState } from "@renderer/types/IMountableState";
import { create } from "zustand";
import { GameRuntimeState } from "../../../shared/GameRuntimeState";
import { useEffect } from "react";
import { subscribeWithSelector } from "zustand/middleware";

interface State extends IMountableState {
    runtimeState: GameRuntimeState;
    setRuntimeState: (runtimeState: GameRuntimeState) => void;
}

export const useGameRuntimeStore = create<State>()(
    subscribeWithSelector((set) => ({
        runtimeState: { status: "idle" },
        setRuntimeState: (runtimeState) => set({ runtimeState }),

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

export function useGameRuntimeState(): GameRuntimeState {
    return useGameRuntimeStore((state) => state.runtimeState);
}

/** @deprecated todo: remove side effects! */
export function useSetGameRuntimeState(): (runtimeState: GameRuntimeState) => void {
    return useGameRuntimeStore((state) => state.setRuntimeState);
}

export function subscribeToGameRuntimeStatus(callback: (state: GameRuntimeState, prev: GameRuntimeState) => void): () => void {
    return useGameRuntimeStore.subscribe(
        (state) => state.runtimeState,
        (state, prev) => callback(state, prev)
    );
}
