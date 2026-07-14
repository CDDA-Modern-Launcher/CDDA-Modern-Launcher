import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function copyRestoredWorld(extractedPath: string, targetWorldPath: string): Promise<void> {
    const entries = await readdir(extractedPath, { withFileTypes: true });
    const worldEntry = entries.length === 1 && entries[0].isDirectory() ? entries[0].name : null;
    const sourcePath = worldEntry === null ? extractedPath : join(extractedPath, worldEntry);
    await mkdir(dirname(targetWorldPath), { recursive: true });
    await copyDirectory(sourcePath, targetWorldPath);
}

async function copyDirectory(sourcePath: string, targetPath: string): Promise<void> {
    await mkdir(targetPath, { recursive: true });
    for (const entry of await readdir(sourcePath, { withFileTypes: true })) {
        const source = join(sourcePath, entry.name);
        const target = join(targetPath, entry.name);
        if (entry.isDirectory()) await copyDirectory(source, target);
        else if (entry.isFile()) await copyFile(source, target);
    }
}
