import { readdir } from "node:fs/promises";
import { join } from "node:path";

const WINDOWS_EXECUTABLE_CANDIDATES = ["cataclysm-tiles.exe", "cataclysm.exe", "cataclysm-launcher.exe"];
const POSIX_EXECUTABLE_CANDIDATES = ["cataclysm-tiles", "cataclysm"];

export async function findExecutable(rootPath: string): Promise<string | null> {
    const candidates = process.platform === "win32" ? WINDOWS_EXECUTABLE_CANDIDATES : POSIX_EXECUTABLE_CANDIDATES;
    const queue = [rootPath];
    while (queue.length > 0) {
        const directory = queue.shift()!;
        const entries = await readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            const path = join(directory, entry.name);
            if (entry.isDirectory()) queue.push(path);
            else if (entry.isFile() && candidates.includes(entry.name)) return path;
        }
    }
    return null;
}
