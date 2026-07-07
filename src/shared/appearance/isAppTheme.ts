import { TAppThemeSource } from "./TAppThemeSource";

export function isAppTheme(value: string | null | undefined): value is TAppThemeSource {
    return value === "system" || value === "dark" || value === "light";
}
