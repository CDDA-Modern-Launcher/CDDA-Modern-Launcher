export function normalizeAssetNameIncludes(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
    return typeof value === "string" && value.length > 0 ? [value] : [];
}
