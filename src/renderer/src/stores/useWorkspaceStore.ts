import { create } from "zustand";
import { WorkspaceStatus } from "../../../shared/workspace/WorkspaceStatus";
import { IMountableState } from "@renderer/types/IMountableState";
import { GameChannelDefinition } from "../../../shared/game-channel/GameChannelDefinition";

interface State extends IMountableState {
    workspaceStatus: WorkspaceStatus;
    isLoaded: boolean;

    onWorkspaceChanged: () => void;

    gameChannels: GameChannelDefinition[];
    selectedGameChannel: GameChannelDefinition | null;

    isSelectingWorkspace: boolean;
    selectWorkspace: () => Promise<void>;
    clearWorkspace: () => Promise<void>;
    setSelectedChannel: (channelId: string) => Promise<void>;
}

export const useWorkspaceStore = create<State>((set, get) => ({
    workspaceStatus: { status: "loading", path: "" },
    isLoaded: false,
    isSelectingWorkspace: false,

    // cached
    gameChannels: [],
    selectedGameChannel: null,

    onWorkspaceChanged: () => {
        const ws = get().workspaceStatus;
        if (ws.status == "ready") {
            set({ gameChannels: ws.gameChannels, selectedGameChannel: ws.selectedGameChannel });
        } else {
            set({ gameChannels: [], selectedGameChannel: null });
        }
    },

    selectWorkspace: async () => {
        set({ isSelectingWorkspace: true });
        try {
            const result = await window.api.workspace.selectNewFolder();
            if (result.status === "selected") {
                set({ workspaceStatus: result.workspace });
                get().onWorkspaceChanged();
                try {
                    // todo ensure workspace change causes mods re-check without calling mods IPC directly
                    await window.api.mods.checkUpdates();
                } catch (error) {
                    console.error("Failed to check mods after workspace selection", error);
                }
            }
        } finally {
            set({ isSelectingWorkspace: false });
        }
    },

    clearWorkspace: async () => {
        const workspaceStatus = await window.api.workspace.clear();
        set({ workspaceStatus });
        get().onWorkspaceChanged();
    },

    setSelectedChannel: async (channelId: string) => {
        const workspaceStatus = await window.api.workspace.setChannel(channelId);
        set({ workspaceStatus });
        get().onWorkspaceChanged();
        try {
            await window.api.mods.checkUpdates();
        } catch (error) {
            console.error("Failed to check mods after channel change", error);
        }
    },

    mount: () => {
        void window.api.workspace.getStatus().then((status) => {
            set({ workspaceStatus: status, isLoaded: true });
            get().onWorkspaceChanged();
        });

        return function cleanup() {
            //
        };
    }
}));

export function useGameChannels(): GameChannelDefinition[] {
    return useWorkspaceStore((state) => state.gameChannels);
}

export function useSelectedGameChannel(): GameChannelDefinition | null {
    return useWorkspaceStore((state) => state.selectedGameChannel);
}

export function useIsWorkspaceLoaded(): boolean {
    return useWorkspaceStore((state) => state.isLoaded);
}
