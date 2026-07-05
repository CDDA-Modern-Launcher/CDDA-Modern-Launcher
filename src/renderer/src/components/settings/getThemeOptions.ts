import { AppTheme } from "../../../../shared/appearance/AppTheme";

type ThemeOption = {
    value: AppTheme;
    label: string;
    icon: string;
};

export function getThemeOptions(t: (key: string) => string): ThemeOption[] {
    return [
        { value: "system", label: t("settings.theme.system"), icon: "◐" },
        { value: "dark", label: t("settings.theme.dark"), icon: "☾" },
        { value: "light", label: t("settings.theme.light"), icon: "☀" }
    ];
}
