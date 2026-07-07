import { cp, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

export async function copyDirectoryContents(sourcePath: string, targetPath: string): Promise<void> {
    await mkdir(targetPath, { recursive: true });
    await Promise.all(
        (await readdir(sourcePath)).map((entry) =>
            cp(join(sourcePath, entry), join(targetPath, entry), {
                recursive: true,
                force: true
            })
        )
    );
}
