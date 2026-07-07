import { ValidatedModInfo } from "./ValidatedModInfo";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { isNodeError } from "../utils/isNodeError";
import { isModInfoEntry } from "./isModInfoEntry";
import { normalizeModDisplayName } from "./normalizeModDisplayName";

export async function readValidatedModInfo(modDir: string, t: (key: string, variables?: Record<string, string | number>) => string): Promise<ValidatedModInfo> {
    const modInfoPath = join(modDir, "modinfo.json");
    let parsed: unknown;

    try {
        parsed = JSON.parse(await readFile(modInfoPath, "utf8"));
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") throw new Error(t("mods.error.modInfoMissing"));
        throw new Error(t("mods.error.modInfoInvalidJson"));
    }

    const entries = Array.isArray(parsed) ? parsed : [parsed];
    const modInfo = entries.find(isModInfoEntry);
    if (modInfo === undefined) throw new Error(t("mods.error.modInfoMissingId"));

    const id = modInfo.id.trim();

    return { id, name: normalizeModDisplayName(modInfo.name, id) };
}
