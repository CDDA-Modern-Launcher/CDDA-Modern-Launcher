export function isGitHubUrl(url: string): boolean {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host === "github.com" || host.endsWith(".github.com") || host === "githubusercontent.com" || host.endsWith(".githubusercontent.com");
    } catch {
        return false;
    }
}
