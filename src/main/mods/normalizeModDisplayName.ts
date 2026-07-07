const tagRegex = /<[^>\r\n]{1,120}>/g;
const whitespaceRegex = /\s+/g;

export function normalizeModDisplayName(value: unknown, fallback: string): string {
    const raw = typeof value === "string" && value.trim().length > 0 ? value : fallback;
    const withoutCddaTags = raw.replace(tagRegex, "");
    const normalized = withoutCddaTags.replace(whitespaceRegex, " ").trim();
    return normalized.length > 0 ? normalized : fallback;
}
