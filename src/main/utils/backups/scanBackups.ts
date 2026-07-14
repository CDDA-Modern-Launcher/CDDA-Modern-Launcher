import { GameBundle } from "../../../shared/game-bundle/GameBundle";
import { BackupSummary } from "../../../shared/backups/types/BackupSummary";
import { access, readdir, readFile, stat } from "node:fs/promises";
import { isNodeError } from "../isNodeError";
import { BackupInstanceInfo } from "../../../shared/backups/types/BackupInstanceInfo";
import { join } from "node:path";
import { BACKUP_ARCHIVE_FILE_NAME, BACKUP_INFO_FILE_NAME } from "../../../shared/Const";
import { BackupInfo } from "../../../shared/backups/types/BackupInfo";

import { getBackupsPath } from "./getBackupsPath";

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

async function pathExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}
