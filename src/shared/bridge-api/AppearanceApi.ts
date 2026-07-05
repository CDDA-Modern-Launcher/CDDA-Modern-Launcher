import { AppTheme } from "../appearance/AppTheme";
import { AppAppearance } from "../appearance/AppAppearance";

export type AppearanceApi = {
    getInitial: () => AppAppearance;
    get: () => Promise<AppAppearance>;
    setTheme: (theme: AppTheme) => Promise<AppAppearance>;
    onChanged: (callback: (appearance: AppAppearance) => void) => () => void;
};
