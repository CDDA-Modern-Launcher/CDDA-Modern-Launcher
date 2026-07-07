import { stat } from "node:fs/promises";
import { isNodeError } from "./isNodeError";

export async function directoryExists(path: string): Promise<boolean> {
    try {
        return (await stat(path)).isDirectory();
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return false;
        throw error;
    }
}
