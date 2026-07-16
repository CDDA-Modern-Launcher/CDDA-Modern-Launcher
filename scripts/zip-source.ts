/* eslint-disable @typescript-eslint/no-require-imports */
// noinspection RedundantIfStatementJS

import * as fs from "node:fs";
import * as path from "node:path";
import archiver = require("archiver");

const projectRoot = process.cwd();

const outputDir = path.join(projectRoot, ".snapshots");
const timestamp = new Date().toISOString().replace(/:/g, "-").replace(/\./g, "-");
const outputFile = path.join(outputDir, `source-${timestamp}.zip`);

const excludedDirs = new Set([".git", ".idea", ".vscode", "node_modules", ".snapshots", ".turbo", ".next", ".cache", ".parcel-cache"]);
const excludedRootDirs = new Set(["build", "dist", "out", "coverage", "workspace"]);
const excludedFiles = new Set([".DS_Store", "Thumbs.db", "npm-debug.log", "yarn-error.log", "pnpm-debug.log"]);
const excludedExtensions = new Set([".log", ".tmp", ".temp", ".zip"]);

function shouldSkip(relativePath: string, dirent: fs.Dirent): boolean {
    const normalized = relativePath.split(path.sep).join("/");
    if (dirent.isDirectory()) {
        if (excludedRootDirs.has(normalized)) return true;
        return excludedDirs.has(dirent.name);
    }
    if (excludedFiles.has(dirent.name)) return true;
    if (excludedExtensions.has(path.extname(dirent.name))) return true;
    if (normalized.endsWith(".zip")) return true;
    return false;
}

function collectFiles(dir: string, result: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const absolutePath = path.join(dir, entry.name);
        const relativePath = path.relative(projectRoot, absolutePath);
        if (shouldSkip(relativePath, entry)) continue;
        if (entry.isDirectory()) {
            collectFiles(absolutePath, result);
            continue;
        }
        if (entry.isFile()) result.push(absolutePath);
    }
    return result;
}

async function main(): Promise<void> {
    fs.mkdirSync(outputDir, { recursive: true });

    const files = collectFiles(projectRoot);
    const output = fs.createWriteStream(outputFile);
    const archive = archiver("zip", { zlib: { level: 9 } });

    const archiveFinished = new Promise<void>((resolve, reject) => {
        output.on("close", resolve);
        output.on("error", reject);
        archive.on("error", reject);
    });

    archive.pipe(output);

    for (const file of files) {
        const archivePath = path.relative(projectRoot, file).split(path.sep).join("/");
        archive.file(file, { name: archivePath });
    }

    await archive.finalize();
    await archiveFinished;

    const sizeMb = archive.pointer() / 1024 / 1024;

    console.log(`Created ${path.relative(projectRoot, outputFile)}`);
    console.log(`Files: ${files.length}`);
    console.log(`Size: ${sizeMb.toFixed(2)} MB`);
}

main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
