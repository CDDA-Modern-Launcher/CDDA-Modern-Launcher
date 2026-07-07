import { createWriteStream } from "node:fs";
import { access, copyFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, join, relative, sep } from "node:path";
import { finished } from "node:stream/promises";

import { BACKUP_ARCHIVE_FILE_NAME, BACKUP_INFO_FILE_NAME } from "../../shared/Const";
import { BackupInfo } from "../../shared/backups/types/BackupInfo";
import { BackupInstanceInfo } from "../../shared/backups/types/BackupInstanceInfo";
import { BackupSummary } from "../../shared/backups/types/BackupSummary";
import { GameBundle } from "../../shared/game-bundle/GameBundle";
import { isNodeError } from "../utils/isNodeError";

export async function scanBackups(gameBundle: GameBundle): Promise<BackupSummary> {
    const backupsPath = getBackupsPath(gameBundle);
    let entries: string[];
    try {
        entries = await readdir(backupsPath);
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return { backups: [], latestBackup: null };
        throw error;
    }

    const backups = (
        await Promise.all(
            entries.map(async (entry): Promise<BackupInstanceInfo | null> => {
                const backupPath = join(backupsPath, entry);
                try {
                    if (!(await stat(backupPath)).isDirectory()) return null;
                    const archivePath = join(backupPath, BACKUP_ARCHIVE_FILE_NAME);
                    const infoPath = join(backupPath, BACKUP_INFO_FILE_NAME);
                    if (!(await pathExists(archivePath))) return null;
                    const parsed = JSON.parse(await readFile(infoPath, "utf8")) as unknown;
                    if (!isGameBackupInfo(parsed)) return null;
                    return { ...parsed, path: backupPath, archivePath };
                } catch (error) {
                    if (isNodeError(error) && error.code === "ENOENT") return null;
                    console.error(`[game-backup] failed to read backup ${backupPath}`, error);
                    return null;
                }
            })
        )
    )
        .filter((backup): backup is BackupInstanceInfo => backup !== null)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    return { backups, latestBackup: backups[0] ?? null };
}

export async function findBackup(gameBundle: GameBundle, backupId: string): Promise<BackupInstanceInfo | null> {
    return (await scanBackups(gameBundle)).backups.find((backup) => backup.id === backupId) ?? null;
}

export function getBackupsPath(gameBundle: GameBundle): string {
    return join(gameBundle.userdataPath, "backups");
}

export function toBackupInfo(backup: BackupInstanceInfo): BackupInfo {
    return {
        schemaVersion: backup.schemaVersion,
        id: backup.id,
        worldName: backup.worldName,
        worldFolderName: backup.worldFolderName,
        characterName: backup.characterName,
        platformId: backup.platformId,
        gameVersion: backup.gameVersion,
        createdAt: backup.createdAt,
        type: backup.type,
        comment: backup.comment
    };
}

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

export async function copyRestoredWorld(extractedPath: string, targetWorldPath: string): Promise<void> {
    const entries = await readdir(extractedPath, { withFileTypes: true });
    const worldEntry = entries.length === 1 && entries[0].isDirectory() ? entries[0].name : null;
    const sourcePath = worldEntry === null ? extractedPath : join(extractedPath, worldEntry);
    await mkdir(dirname(targetWorldPath), { recursive: true });
    await copyDirectory(sourcePath, targetWorldPath);
}

function isGameBackupInfo(value: unknown): value is BackupInfo {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Partial<BackupInfo>;
    return (
        candidate.schemaVersion === 1 &&
        typeof candidate.id === "string" &&
        typeof candidate.worldName === "string" &&
        typeof candidate.worldFolderName === "string" &&
        typeof candidate.characterName === "string" &&
        typeof candidate.platformId === "string" &&
        typeof candidate.gameVersion === "string" &&
        typeof candidate.createdAt === "string" &&
        (candidate.type === "manual" || candidate.type === "auto") &&
        typeof candidate.comment === "string"
    );
}

function safePathSegment(value: string): string {
    return (
        value
            .split("")
            .map((char) => (/[<>:"/\\|?*]/.test(char) || char.charCodeAt(0) < 32 ? "_" : char))
            .join("")
            .trim() || "backup"
    );
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

async function copyDirectory(sourcePath: string, targetPath: string): Promise<void> {
    await mkdir(targetPath, { recursive: true });
    for (const entry of await readdir(sourcePath, { withFileTypes: true })) {
        const source = join(sourcePath, entry.name);
        const target = join(targetPath, entry.name);
        if (entry.isDirectory()) await copyDirectory(source, target);
        else if (entry.isFile()) await copyFile(source, target);
    }
}

async function pathExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

export { safePathSegment };
