import { ModSourceProvider } from "../../shared/modRepository";

export type ParsedModSourceUrl = {
    provider: ModSourceProvider;
    normalizedUrl: string;
};

export function parseModSourceUrl(input: string): ParsedModSourceUrl {
    let parsed: URL;

    try {
        parsed = new URL(input.trim());
    } catch {
        throw new Error("Введите корректную HTTPS-ссылку на публичный git-репозиторий.");
    }

    if (parsed.protocol !== "https:") {
        throw new Error("Поддерживаются только HTTPS-ссылки на публичные git-репозитории.");
    }

    if (parsed.username.length > 0 || parsed.password.length > 0) {
        throw new Error("Ссылка не должна содержать логин, пароль или токен доступа.");
    }

    if (!parsed.pathname.endsWith(".git")) {
        throw new Error("Ссылка должна вести на .git репозиторий, например https://github.com/user/repo.git.");
    }

    const provider = getProvider(parsed.hostname);

    return {
        provider,
        normalizedUrl: parsed.toString()
    };
}

function getProvider(hostname: string): ModSourceProvider {
    const normalized = hostname.toLowerCase();

    if (normalized === "github.com") {
        return "github";
    }

    if (normalized === "gitlab.com") {
        return "gitlab";
    }

    return "generic";
}
