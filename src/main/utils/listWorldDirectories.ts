import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { isNodeError } from "./isNodeError";

export async function listWorldDirectories(savePath: string): Promise<string[]> {
    try {
        const entries = await readdir(savePath, { withFileTypes: true });
        return entries.filter((entry) => entry.isDirectory()).map((entry) => join(savePath, entry.name));
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return [];
        throw error;
    }
}
