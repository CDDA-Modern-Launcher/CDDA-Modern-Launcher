export function isModInfoEntry(value: unknown): value is { type: "MOD_INFO"; id: string; name?: string } {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return candidate.type === "MOD_INFO" && typeof candidate.id === "string" && candidate.id.trim().length > 0;
}
