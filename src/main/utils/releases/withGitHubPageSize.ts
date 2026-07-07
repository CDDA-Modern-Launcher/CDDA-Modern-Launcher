export function withGitHubPageSize(url: string, page: number): string {
    try {
        const value = new URL(url);
        if (value.hostname === "api.github.com") {
            if (!value.searchParams.has("per_page")) value.searchParams.set("per_page", "50");
            value.searchParams.set("page", page.toString());
        }
        return value.toString();
    } catch {
        return url;
    }
}
