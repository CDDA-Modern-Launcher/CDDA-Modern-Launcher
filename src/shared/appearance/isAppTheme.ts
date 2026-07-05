import { AppTheme } from "./AppTheme";

export function isAppTheme(value: string | null | undefined): value is AppTheme {
    return value === "system" || value === "dark" || value === "light";
}
