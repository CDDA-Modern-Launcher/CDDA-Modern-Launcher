import { TModSourceProvider } from "../../shared/mods/TModSourceProvider";

export type ParsedModSourceUrl = {
    provider: TModSourceProvider;
    normalizedUrl: string;
};

export function parseModSourceUrl(input: string, t: (key: string, variables?: Record<string, string | number>) => string): ParsedModSourceUrl {
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

    const provider = getProvider(parsed.hostname);

    return {
        provider,
        normalizedUrl: parsed.toString()
    };
}

function getProvider(hostname: string): TModSourceProvider {
    const normalized = hostname.toLowerCase();

    if (normalized === "github.com") {
        return "github";
    }

    if (normalized === "gitlab.com") {
        return "gitlab";
    }

    return "generic";
}
