const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

type NetworkRequestInit = Exclude<Parameters<typeof fetch>[1], undefined>;
type NetworkHeadersInit = NonNullable<NetworkRequestInit["headers"]>;

type CacheEntry<T> = {
    createdAt: number;
    value: T;
};

type GitHubJsonOptions = {
    init?: NetworkRequestInit;
    forceRefresh?: boolean;
    ttlMs?: number;
    cacheKey?: string;
};

export class GitHubNetworkManager {
    private readonly cache = new Map<string, CacheEntry<unknown>>();
    private readonly pending = new Map<string, Promise<unknown>>();

    async getJson<T>(url: string, options: GitHubJsonOptions = {}): Promise<T> {
        const key = options.cacheKey ?? getRequestCacheKey(url, options.init);
        if (options.forceRefresh === true) this.cache.delete(key);

        const cached = this.cache.get(key);
        if (cached !== undefined && Date.now() - cached.createdAt < (options.ttlMs ?? DEFAULT_CACHE_TTL_MS)) return cached.value as T;

        const pending = this.pending.get(key);
        if (pending !== undefined) return pending as Promise<T>;

        const request = this.fetchJson<T>(url, options.init).then((value) => {
            this.cache.set(key, { createdAt: Date.now(), value });
            return value;
        });
        this.pending.set(key, request);
        try {
            return await request;
        } finally {
            this.pending.delete(key);
        }
    }

    async fetch(url: string, init?: NetworkRequestInit): Promise<Response> {
        return this.fetchWithLogging(url, init);
    }

    async getCached<T>(key: string, loader: () => Promise<T>, options: { forceRefresh?: boolean; ttlMs?: number } = {}): Promise<T> {
        if (options.forceRefresh === true) this.cache.delete(key);

        const cached = this.cache.get(key);
        if (cached !== undefined && Date.now() - cached.createdAt < (options.ttlMs ?? DEFAULT_CACHE_TTL_MS)) return cached.value as T;

        const pending = this.pending.get(key);
        if (pending !== undefined) return pending as Promise<T>;

        const request = loader().then((value) => {
            this.cache.set(key, { createdAt: Date.now(), value });
            return value;
        });
        this.pending.set(key, request);
        try {
            return await request;
        } finally {
            this.pending.delete(key);
        }
    }

    invalidate(url: string, init?: NetworkRequestInit): void {
        this.cache.delete(getRequestCacheKey(url, init));
    }

    private async fetchJson<T>(url: string, init?: NetworkRequestInit): Promise<T> {
        const response = await this.fetchWithLogging(url, init);
        if (!response.ok) throw new Error(`GitHub request failed: ${response.status} ${response.statusText}`);
        return response.json() as Promise<T>;
    }

    private async fetchWithLogging(url: string, init?: NetworkRequestInit): Promise<Response> {
        const requestInit = withGitHubDefaults(init);
        const method = requestInit.method ?? "GET";
        const startedAt = Date.now();
        try {
            const response = await fetch(url, requestInit);
            const durationMs = Date.now() - startedAt;
            console.info(
                `[github] ${method} ${response.status} ${response.statusText} remaining=${response.headers.get("x-ratelimit-remaining") ?? "?"} reset=${response.headers.get("x-ratelimit-reset") ?? "?"} durationMs=${durationMs} url=${url}`
            );
            return response;
        } catch (error) {
            const durationMs = Date.now() - startedAt;
            console.error(`[github] ${method} failed durationMs=${durationMs} url=${url}`, error);
            throw error;
        }
    }
}

function withGitHubDefaults(init?: NetworkRequestInit): NetworkRequestInit {
    return {
        ...init,
        headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "Modern-Cataclysm-Launcher",
            ...toHeaderRecord(init?.headers)
        }
    };
}

function toHeaderRecord(headers: NetworkHeadersInit | undefined): Record<string, string> {
    if (headers === undefined) return {};
    if (headers instanceof Headers) return Object.fromEntries(headers.entries());
    if (Array.isArray(headers)) return Object.fromEntries(headers);
    return headers;
}

function getRequestCacheKey(url: string, init?: NetworkRequestInit): string {
    return JSON.stringify({
        method: init?.method ?? "GET",
        url,
        headers: normalizeHeaders(init?.headers)
    });
}

function normalizeHeaders(headers: NetworkHeadersInit | undefined): [string, string][] {
    return Object.entries(toHeaderRecord(headers)).sort(([left], [right]) => left.localeCompare(right));
}
