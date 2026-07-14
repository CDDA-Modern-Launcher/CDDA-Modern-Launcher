import { mkdir, readdir } from "node:fs/promises";
import { basename, dirname, join, relative, sep } from "node:path";
import { createWriteStream } from "node:fs";
import { finished } from "node:stream/promises";

export async function createZipFromDirectory(sourcePath: string, archivePath: string, onProgress: (percent: number | null) => void): Promise<void> {
    const { default: archiver } = await import("archiver");
    await mkdir(dirname(archivePath), { recursive: true });
    const files = await listFiles(sourcePath);
    const total = files.length;
    let processed = 0;
    const output = createWriteStream(archivePath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("entry", () => {
        processed += 1;
        onProgress(total === 0 ? 100 : Math.min(99, Math.round((processed / total) * 100)));
    });
    archive.pipe(output);
    for (const file of files) {
        archive.file(file.path, { name: file.relativePath });
    }
    await archive.finalize();
    await finished(output);
    onProgress(100);
}

async function listFiles(rootPath: string): Promise<Array<{ path: string; relativePath: string }>> {
    const result: Array<{ path: string; relativePath: string }> = [];
    const queue = [rootPath];
    while (queue.length > 0) {
        const current = queue.shift()!;
        for (const entry of await readdir(current, { withFileTypes: true })) {
            const path = join(current, entry.name);
            if (entry.isDirectory()) queue.push(path);
            else if (entry.isFile()) result.push({ path, relativePath: join(basename(rootPath), relative(rootPath, path)).split(sep).join("/") });
        }
    }
    return result;
}
