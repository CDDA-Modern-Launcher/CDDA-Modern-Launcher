export function getReleaseNameDisplay(value: string): string {
    const buildId = value.match(/20\d{2}-\d{2}-\d{2}-\d{4}/)?.[0];
    if (buildId !== undefined) return buildId;
    return value
        .replace(/^Cataclysm-DDA experimental build\s+/i, "")
        .replace(/^Cataclysm-DDA\s+/i, "")
        .replace(/^cdda-(?:windows|linux)-[^-]+(?:-[^-]+)*-/i, "")
        .replace(/\.(?:zip|tar\.gz|tgz)$/i, "")
        .trim();
}
