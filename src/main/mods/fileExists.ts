import { access } from "node:fs/promises";

import { isNodeError } from "../utils/isNodeError";

export async function fileExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return false;
        throw error;
    }
}
