import { TAppThemeSource } from "../appearance/TAppThemeSource";
import { TAppTheme } from "../appearance/TAppTheme";

export type AppearanceApi = {
    getThemeSource: () => Promise<TAppThemeSource>;
    setThemeSource: (themeSource: TAppThemeSource) => Promise<AppearanceBundle>;

    getTheme: () => Promise<TAppTheme>;

    onAppearanceChanged: (callback: (appearance: { themeSource: TAppThemeSource; theme: TAppTheme }) => void) => () => void;
};

export type AppearanceBundle = {
    themeSource: TAppThemeSource;
    theme: TAppTheme;
};

export const AppearanceApiKey = {
    getThemeSource: "appearance:getThemeSource",
    setThemeSource: "appearance:setThemeSource",

    getTheme: "appearance:getTheme",

    onAppearanceChanged: "appearance:onAppearanceChanged"
};
