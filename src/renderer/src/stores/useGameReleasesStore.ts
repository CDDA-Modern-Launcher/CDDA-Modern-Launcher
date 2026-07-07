import { create } from "zustand";
import { GithubRelease } from "../../../shared/GithubRelease";

interface GameReleasesStoreState {
    releases: GithubRelease[];
    isLoading: boolean;
    isLoadingReleaseNotes: boolean;
    load: (forceRefresh?: boolean) => Promise<GithubRelease[]>;
    setReleaseNotesLoading: (isLoadingReleaseNotes: boolean) => void;
    clear: () => void;
}

export const useGameReleasesStore = create<GameReleasesStoreState>()((set) => ({
    releases: [],
    isLoading: false,
    isLoadingReleaseNotes: false,

    load: async (forceRefresh = false) => {
        set({ isLoading: true });
        try {
            const releases = await window.api.game.getReleases(forceRefresh);
            set({ releases });
            return releases;
        } catch (error) {
            console.error("Failed to load releases", error);
            set({ releases: [] });
            return [];
        } finally {
            set({ isLoading: false });
        }
    },

    setReleaseNotesLoading: (isLoadingReleaseNotes) => set({ isLoadingReleaseNotes }),
    clear: () => set({ releases: [] })
}));
