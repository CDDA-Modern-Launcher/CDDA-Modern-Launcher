import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { isModInfoEntry } from "./isModInfoEntry";
import { normalizeModDisplayName } from "./normalizeModDisplayName";
import { ValidatedModInfo } from "./ValidatedModInfo";

export async function readValidatedModInfo(modPath: string, translate: (key: string, variables?: Record<string, string | number>) => string): Promise<ValidatedModInfo> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(await readFile(join(modPath, "modinfo.json"), "utf8"));
    } catch {
        throw new Error(translate("mods.error.modinfo.invalid"));
    }

    const entries = Array.isArray(parsed) ? parsed : [parsed];
    const entry = entries.find(isModInfoEntry);
    if (entry === undefined) throw new Error(translate("mods.error.modinfo.invalid"));

    const id = (entry.id ?? entry.ident)?.trim();
    if (id === undefined || id.length === 0) throw new Error(translate("mods.error.modinfo.invalid"));

    const name = normalizeModDisplayName(entry.name, id);
    const description = typeof entry.description === "string" && entry.description.trim().length > 0 ? entry.description.trim() : undefined;
    return { id, name, description };
}
