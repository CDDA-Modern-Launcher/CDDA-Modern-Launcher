import { readdir } from "node:fs/promises";
import { getKeySaveFileKind } from "../game/getKeySaveFileKind";
import { join } from "node:path";
import { isNodeError } from "./isNodeError";

export async function listExistingKeySaveFiles(worldPath: string): Promise<string[]> {
    try {
        const entries = await readdir(worldPath, { withFileTypes: true });
        return entries.filter((entry) => entry.isFile() && getKeySaveFileKind(entry.name) !== null).map((entry) => join(worldPath, entry.name));
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return [];
        throw error;
    }
}
