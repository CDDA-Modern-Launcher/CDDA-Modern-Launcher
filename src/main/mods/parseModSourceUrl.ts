export function parseModSourceUrl(input: string, t: (key: string, variables?: Record<string, string | number>) => string): string {
    let parsed: URL;

    try {
        parsed = new URL(input.trim());
    } catch {
        throw new Error(t("mods.error.source.url.invalid"));
    }

    if (parsed.protocol !== "https:") {
        throw new Error(t("mods.error.source.url.https.only"));
    }

    if (parsed.username.length > 0 || parsed.password.length > 0) {
        throw new Error(t("mods.error.source.url.credentials"));
    }

    if (!parsed.pathname.endsWith(".git")) {
        throw new Error(t("mods.error.source.url.git.suffix"));
    }

    return parsed.toString();
}
