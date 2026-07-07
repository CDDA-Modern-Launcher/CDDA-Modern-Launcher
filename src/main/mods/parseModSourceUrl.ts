export function parseModSourceUrl(input: string, t: (key: string, variables?: Record<string, string | number>) => string): string {
    let parsed: URL;

    try {
        parsed = new URL(input.trim());
    } catch {
        throw new Error(t("mods.error.sourceUrlInvalid"));
    }

    if (parsed.protocol !== "https:") {
        throw new Error(t("mods.error.sourceUrlHttpsOnly"));
    }

    if (parsed.username.length > 0 || parsed.password.length > 0) {
        throw new Error(t("mods.error.sourceUrlCredentials"));
    }

    if (!parsed.pathname.endsWith(".git")) {
        throw new Error(t("mods.error.sourceUrlGitSuffix"));
    }

    return parsed.toString();
}
