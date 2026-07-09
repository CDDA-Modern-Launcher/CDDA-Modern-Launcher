import { create } from "zustand";
import { WorkspaceStatus } from "../../../shared/workspace/WorkspaceStatus";
import { IMountableState } from "@renderer/types/IMountableState";
import { GameChannelDefinition } from "../../../shared/game-channel/GameChannelDefinition";
import { BUILT_IN_GAME_CHANNELS } from "../../../shared/game-channel/BUILT_IN_GAME_CHANNELS";
import { DEFAULT_GAME_CHANNEL_ID } from "../../../shared/Const";

interface State extends IMountableState {
    workspaceStatus: WorkspaceStatus;
    isLoaded: boolean;

    onWorkspaceChanged: () => void;

    gameChannels: GameChannelDefinition[];
    selectedGameChannel: GameChannelDefinition | null;

    isSelectingRepository: boolean;
    selectRepository: () => Promise<void>;
    setSelectedChannel: (channelId: string) => Promise<void>;
}

export const useWorkspaceStore = create<State>((set, get) => ({
    workspaceStatus: { status: "loading", path: "" },
    isLoaded: false,
    isSelectingRepository: false,

    // cached
    gameChannels: [],
    selectedGameChannel: null,

    onWorkspaceChanged: () => {
        const ws = get().workspaceStatus;
        if (ws.status == "ready") {
            const customChannels = ws.config.customGameChannels;
            const customIds = new Set(customChannels.map((channel) => channel.id));
            const gameChannels = [...BUILT_IN_GAME_CHANNELS.filter((channel) => !customIds.has(channel.id)), ...customChannels];
            const selectedGameChannel =
                gameChannels.find((channel) => channel.id === ws.config.selectedChannelId) ?? //
                gameChannels.find((channel) => channel.id === DEFAULT_GAME_CHANNEL_ID) ??
                gameChannels[0] ??
                null;

            set({ gameChannels, selectedGameChannel });
        } else {
            set({ gameChannels: [], selectedGameChannel: null });
        }
    },

    selectRepository: async () => {
        set({ isSelectingRepository: true });
        try {
            const result = await window.api.workspace.selectNewFolder();
            if (result.status === "selected") {
                set({ workspaceStatus: result.repository });
                get().onWorkspaceChanged();
                try {
                    // todo ensure workspace change causes mods re-check without calling mods IPC directly
                    await window.api.mods.checkUpdates();
                } catch (error) {
                    console.error("Failed to check mods after repository selection", error);
                }
            }
        } finally {
            set({ isSelectingRepository: false });
        }
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
