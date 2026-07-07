import { create } from "zustand";
import { TAppThemeSource } from "../../../shared/appearance/TAppThemeSource";
import { TAppTheme } from "../../../shared/appearance/TAppTheme";
import { AppearanceBundle } from "../../../shared/bridge-api/AppearanceApi";

interface State {
    themeSource: TAppThemeSource;
    setThemeSource: (themeSource: TAppThemeSource) => Promise<AppearanceBundle>;

    theme: TAppTheme;

    mount: () => () => void;
}

export const useAppearanceStore = create<State>()((set) => ({
    themeSource: "system",
    setThemeSource: async (themeSource: TAppThemeSource): Promise<AppearanceBundle> => await window.api.appearance.setThemeSource(themeSource),

    theme: "dark",

    mount: () => {
        void window.api.appearance.getThemeSource().then((themeSource) => set({ themeSource }));
        void window.api.appearance.getTheme().then((theme) => set({ theme }));
        return window.api.appearance.onAppearanceChanged(({ themeSource, theme }: { themeSource: TAppThemeSource; theme: TAppTheme }) => set({ themeSource, theme }));
    }
}));
