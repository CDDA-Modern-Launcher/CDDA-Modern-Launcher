export function normalizeLocale(locale: string): string {
    return locale.trim().replace("_", "-").toLowerCase();
}
