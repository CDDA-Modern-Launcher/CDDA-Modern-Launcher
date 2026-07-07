import { create } from "zustand";
import { WorkspaceStatus } from "../../../shared/workspace/WorkspaceStatus";
import { IMountableState } from "@renderer/types/IMountableState";

interface State extends IMountableState {
    workspaceStatus: WorkspaceStatus;

    isSelectingRepository: boolean;
    setSelectingRepository: (isSelectingRepository: boolean) => void;
    selectRepository: () => Promise<void>;
    setSelectedChannel: (channelId: string) => Promise<void>;
}

export const useWorkspaceStore = create<State>((set) => ({
    workspaceStatus: { status: "unconfigured" },

    isSelectingRepository: false,

    setSelectingRepository: (isSelectingRepository: boolean) => set({ isSelectingRepository }),

    selectRepository: async () => {
        set({ isSelectingRepository: true });
        try {
            const result = await window.api.workspace.selectNewFolder();
            if (result.status === "selected") {
                set({ workspaceStatus: result.repository });
                try {
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
        const repository = await window.api.workspace.setChannel(channelId);
        set({ workspaceStatus: repository });
        try {
            await window.api.mods.checkUpdates();
        } catch (error) {
            console.error("Failed to check mods after channel change", error);
        }
    },

    mount: () => {
        void window.api.workspace.getStatus().then((status) => set({ workspaceStatus: status }));

        return function cleanup() {
            //
        };
    }
}));
