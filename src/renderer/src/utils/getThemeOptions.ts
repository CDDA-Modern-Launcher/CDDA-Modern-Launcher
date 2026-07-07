import { TAppThemeSource } from "../../../shared/appearance/TAppThemeSource";
import { TLocalizeFn } from "@renderer/stores/useLocaleStore";

type ThemeOption = {
    value: TAppThemeSource;
    label: string;
    icon: string;
};

export function getThemeOptions(t: TLocalizeFn): ThemeOption[] {
    return [
        { value: "system", label: t("settings.theme.system"), icon: "◐" },
        { value: "dark", label: t("settings.theme.dark"), icon: "☾" },
        { value: "light", label: t("settings.theme.light"), icon: "☀" }
    ];
}
