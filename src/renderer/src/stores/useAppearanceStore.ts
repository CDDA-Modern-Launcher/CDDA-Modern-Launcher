import { create } from "zustand";
import { TAppThemeSource } from "../../../shared/appearance/TAppThemeSource";
import { TAppTheme } from "../../../shared/appearance/TAppTheme";
import { AppearanceBundle } from "../../../shared/bridge-api/AppearanceApi";
import { IMountableState } from "@renderer/types/IMountableState";

interface State extends IMountableState {
    themeSource: TAppThemeSource;
    setThemeSource: (themeSource: TAppThemeSource) => Promise<AppearanceBundle>;

    theme: TAppTheme;
}

const initialAppearance = window.api.appearance.getInitialAppearance();

export const useAppearanceStore = create<State>()((set) => ({
    themeSource: initialAppearance.themeSource,
    setThemeSource: async (themeSource: TAppThemeSource): Promise<AppearanceBundle> => {
        const appearance = await window.api.appearance.setThemeSource(themeSource);
        set(appearance);
        return appearance;
    },

    theme: initialAppearance.theme,

    mount: () => {
        void Promise.all([window.api.appearance.getThemeSource(), window.api.appearance.getTheme()]).then(([themeSource, theme]) => set({ themeSource, theme }));
        return window.api.appearance.onAppearanceChanged(({ themeSource, theme }: { themeSource: TAppThemeSource; theme: TAppTheme }) => set({ themeSource, theme }));
    }
}));
