export type ModInfoEntry = {
    type: "MOD_INFO";
    id?: string;
    ident?: string;
    name?: string;
    description?: string;
};

export function isModInfoEntry(value: unknown): value is ModInfoEntry {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Record<string, unknown>;
    const id = typeof candidate.id === "string" ? candidate.id : candidate.ident;
    return candidate.type === "MOD_INFO" && typeof id === "string" && id.trim().length > 0;
}
