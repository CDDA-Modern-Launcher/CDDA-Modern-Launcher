import { stat, utimes } from "node:fs/promises";
import { isNodeError } from "./isNodeError";

export async function getReusableArchive(path: string, expectedBytes: number): Promise<{ size: number } | null> {
    try {
        const archiveStat = await stat(path);
        if (!archiveStat.isFile() || archiveStat.size <= 0) return null;
        if (expectedBytes > 0 && archiveStat.size !== expectedBytes) {
            console.warn(`[game-install] cached archive size mismatch path=${path} actual=${archiveStat.size} expected=${expectedBytes}`);
            return null;
        }
        const now = new Date();
        await utimes(path, now, now);
        return { size: archiveStat.size };
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return null;
        throw error;
    }
}
