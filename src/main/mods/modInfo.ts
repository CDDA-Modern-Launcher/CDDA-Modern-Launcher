import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type ValidatedModInfo = {
    id: string;
    name: string;
};

export async function readValidatedModInfo(modDir: string): Promise<ValidatedModInfo> {
    const modInfoPath = join(modDir, "modinfo.json");
    let parsed: unknown;

    try {
        parsed = JSON.parse(await readFile(modInfoPath, "utf8"));
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") {
            throw new Error("В репозитории не найден modinfo.json.");
        }

        throw new Error("modinfo.json найден, но его не удалось прочитать как JSON.");
    }

    const entries = Array.isArray(parsed) ? parsed : [parsed];
    const modInfo = entries.find(isModInfoEntry);

    if (modInfo === undefined) {
        throw new Error("modinfo.json найден, но в нём нет объекта MOD_INFO с полем id.");
    }

    const id = modInfo.id.trim();

    return { id, name: normalizeModDisplayName(modInfo.name, id) };
}

export function normalizeModDisplayName(value: unknown, fallback: string): string {
    const raw = typeof value === "string" && value.trim().length > 0 ? value : fallback;
    const withoutCddaTags = raw.replace(/<[^>\r\n]{1,120}>/g, "");
    const normalized = withoutCddaTags.replace(/\s+/g, " ").trim();

    return normalized.length > 0 ? normalized : fallback;
}

function isModInfoEntry(value: unknown): value is { type: "MOD_INFO"; id: string; name?: string } {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidate = value as Record<string, unknown>;
    return candidate.type === "MOD_INFO" && typeof candidate.id === "string" && candidate.id.trim().length > 0;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error;
}
