import { create } from "zustand";
import { IMountableState } from "@renderer/types/IMountableState";
import { GameFileOperationState } from "../../../shared/game-bundle/GameFileOperationState";

interface GameFileOperationStoreState extends IMountableState {
    operation: GameFileOperationState;
    isRunning: boolean;
}

export const useGameFileOperationStore = create<GameFileOperationStoreState>()((set) => ({
    operation: { status: "idle" },
    isRunning: false,

    mount: () => {
        window.api.game
            .getFileOperation()
            .then((operation) => set({ operation, isRunning: operation.status === "running" }))
            .catch((error) => console.error("Failed to read game file operation", error));

        const unsubscribe = window.api.game.onFileOperationChanged((operation) => set({ operation, isRunning: operation.status === "running" }));
        return () => unsubscribe();
    }
}));
