import { createWriteStream, type FSWatcher, watch } from "node:fs";
import { access, copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, sep } from "node:path";
import { finished } from "node:stream/promises";

import extractZip from "extract-zip";

import type { LocalizationService } from "../localization/LocalizationService";
import type { WorkspaceService } from "../repository/WorkspaceService";
import { BACKUP_ARCHIVE_FILE_NAME, BACKUP_INFO_FILE_NAME, BACKUPS_DIRECTORY_NAME } from "../../shared/Const";
import { TBackupKind } from "../../shared/backups/types/TBackupKind";
import { BackupInfo } from "../../shared/backups/types/BackupInfo";
import { BackupInstanceInfo } from "../../shared/backups/types/BackupInstanceInfo";
import { BackupProgress } from "../../shared/backups/types/BackupProgress";
import { BackupSummary } from "../../shared/backups/types/BackupSummary";
import { BackupSummaryUpdate } from "../../shared/backups/types/BackupSummaryUpdate";
import { EBackupCreateResult } from "../../shared/backups/types/EBackupCreateResult";
import { EBackupDeleteResult } from "../../shared/backups/types/EBackupDeleteResult";
import { toRotationCount } from "../../shared/backups/toRotationCount";
import { EBackupRestoreResult } from "../../shared/backups/types/EBackupRestoreResult";

import { EBackupRenameResult } from "../../shared/backups/types/EBackupRenameResult";
import { GameBundle } from "../../shared/game-bundle/GameBundle";
import { GameSaveSummary } from "../../shared/GameSaveSummary";
import { isNodeError } from "../utils/isNodeError";
import { BrowserWindow } from "electron";
import { Bridge } from "../../shared/bridge-api/Bridge";

export type GameBackupContext = {
    gameBundle: GameBundle;
    saves: GameSaveSummary | null;
    gameRunning: boolean;
    savesStable: boolean;
};

export class GameBackupService {
    private watcher: FSWatcher | null = null;
    private watchedGameBundleId: string | null = null;
    private watchedBackupsPath: string | null = null;
    private watcherRefreshTimer: NodeJS.Timeout | null = null;
    private isBusy = false;

    constructor(
        private readonly repositoryService: WorkspaceService,
        private readonly localizationService: LocalizationService
    ) {}

    async updateActiveGameBundle(gameBundle: GameBundle | null): Promise<void> {
        if (gameBundle === null) {
            this.stopWatching();
            return;
        }

        const backupsPath = getBackupsPath(gameBundle);
        if (this.watchedGameBundleId === gameBundle.id && this.watchedBackupsPath === backupsPath) return;
        this.stopWatching();
        this.watchedGameBundleId = gameBundle.id;
        this.watchedBackupsPath = backupsPath;
        await mkdir(backupsPath, { recursive: true });
        this.watcher = watch(backupsPath, { persistent: false }, () => this.scheduleSummaryRefresh(gameBundle));
    }

    async getSummary(gameBundle: GameBundle | null): Promise<BackupSummary> {
        return gameBundle === null ? { backups: [], latestBackup: null } : scanBackups(gameBundle);
    }

    async createManualBackup(context: GameBackupContext): Promise<EBackupCreateResult> {
        return this.createBackup(context, "manual");
    }

    async createAutoBackup(context: GameBackupContext): Promise<EBackupCreateResult> {
        if (!context.gameRunning) return { status: "unavailable", message: this.t("backup.error.autoRequiresRunning") };
        if (this.isBusy) return { status: "blocked", message: this.t("backup.error.busy") };
        const settings = await this.repositoryService.getWorkspaceSettings();
        if (!settings.backupsEnabled || settings.autoBackupLimit === "disabled") return { status: "unavailable", message: this.t("backup.error.autoDisabled") };
        return this.createBackup(context, "auto");
    }

    async restoreBackup(context: GameBackupContext, backupId: string): Promise<EBackupRestoreResult> {
        if (context.gameRunning) return { status: "blocked", message: this.t("backup.error.restoreBlockedRunning") };
        if (this.isBusy) return { status: "blocked", message: this.t("backup.error.busy") };
        const backup = await findBackup(context.gameBundle, backupId);
        if (backup === null) return { status: "unavailable", message: this.t("backup.error.notFound") };
        const savePath = join(context.gameBundle.userdataPath, "save");
        const worldPath = join(savePath, backup.worldFolderName);
        const tempPath = `${worldPath}.restore-${Date.now()}`;

        this.isBusy = true;
        this.setProgress({ status: "restoring", backupId, percent: null });
        try {
            await rm(tempPath, { recursive: true, force: true });
            await mkdir(dirname(tempPath), { recursive: true });
            await extractZip(backup.archivePath, { dir: tempPath });
            await rm(worldPath, { recursive: true, force: true });
            await mkdir(savePath, { recursive: true });
            await copyRestoredWorld(tempPath, worldPath);
            await rm(tempPath, { recursive: true, force: true });
            this.setProgress({ status: "completed" });
            queueMicrotask(() => this.setProgress({ status: "idle" }));
            const summary = await this.emitSummary(context.gameBundle);
            return { status: "restored", summary };
        } catch (error) {
            await rm(tempPath, { recursive: true, force: true });
            const message = error instanceof Error ? error.message : String(error);
            this.setProgress({ status: "error", message });
            return { status: "error", message };
        } finally {
            this.isBusy = false;
        }
    }

    async deleteBackup(gameBundle: GameBundle | null, backupId: string): Promise<EBackupDeleteResult> {
        if (gameBundle === null) return { status: "unavailable", message: this.t("game.error.noGameBundle") };
        const backup = await findBackup(gameBundle, backupId);
        if (backup === null) return { status: "unavailable", message: this.t("backup.error.notFound") };
        await rm(backup.path, { recursive: true, force: true });
        return { status: "deleted", summary: await this.emitSummary(gameBundle) };
    }

    async renameBackup(gameBundle: GameBundle | null, backupId: string, comment: string): Promise<EBackupRenameResult> {
        if (gameBundle === null) return { status: "unavailable", message: this.t("game.error.noGameBundle") };
        const backup = await findBackup(gameBundle, backupId);
        if (backup === null) return { status: "unavailable", message: this.t("backup.error.notFound") };
        const updated: BackupInfo = { ...toBackupInfo(backup), comment: comment.trim(), type: "manual" };
        await writeFile(join(backup.path, BACKUP_INFO_FILE_NAME), `${JSON.stringify(updated, null, 2)}\n`, "utf8");
        const summary = await this.emitSummary(gameBundle);
        const renamed = summary.backups.find((candidate) => candidate.id === backupId);
        return renamed === undefined ? { status: "unavailable", message: this.t("backup.error.notFound") } : { status: "renamed", summary, backup: renamed };
    }

    stop(): void {
        this.stopWatching();
    }

    private t(key: string): string {
        return this.localizationService.t(key);
    }

    private async createBackup(context: GameBackupContext, type: TBackupKind): Promise<EBackupCreateResult> {
        const settings = await this.repositoryService.getWorkspaceSettings();
        if (!settings.backupsEnabled) return { status: "unavailable", message: this.t("backup.error.disabled") };
        if (!context.savesStable) return { status: "blocked", message: this.t("backup.error.savesChanging") };
        if (this.isBusy) return { status: "blocked", message: this.t("backup.error.busy") };
        const world = context.saves?.currentWorld ?? null;
        if (world === null || world.characterName === null) return { status: "unavailable", message: this.t("backup.error.worldAndCharacterMissing") };
        const sourceWorldPath = join(context.gameBundle.userdataPath, "save", world.folderName);
        if (!(await pathExists(sourceWorldPath))) return { status: "unavailable", message: this.t("backup.error.worldFolderMissing") };

        const id = `${new Date().toISOString().replace(/[.:]/g, "-")}-${type}`;
        const backupPath = join(getBackupsPath(context.gameBundle), safePathSegment(id));
        const archivePath = join(backupPath, BACKUP_ARCHIVE_FILE_NAME);
        const info: BackupInfo = {
            schemaVersion: 1,
            id,
            worldName: world.name,
            worldFolderName: world.folderName,
            characterName: world.characterName,
            platformId: context.gameBundle.manifest.channelId,
            gameVersion: context.gameBundle.manifest.releaseName || context.gameBundle.manifest.releaseId,
            createdAt: new Date().toISOString(),
            type,
            comment: ""
        };

        this.isBusy = true;
        this.setProgress({ status: "creating", percent: null, worldName: world.name, characterName: world.characterName, type });
        try {
            await mkdir(backupPath, { recursive: true });
            await createZipFromDirectory(sourceWorldPath, archivePath, (percent) => this.setProgress({ status: "creating", percent, worldName: world.name, characterName: world.characterName!, type }));
            await writeFile(join(backupPath, BACKUP_INFO_FILE_NAME), `${JSON.stringify(info, null, 2)}\n`, "utf8");
            await this.rotateBackups(context.gameBundle, type);
            const summary = await this.emitSummary(context.gameBundle);
            const backup = summary.backups.find((candidate) => candidate.id === id);
            this.setProgress({ status: "completed" });
            queueMicrotask(() => this.setProgress({ status: "idle" }));
            return backup === undefined ? { status: "error", message: this.t("backup.error.createdBackupMissing") } : { status: "created", summary, backup };
        } catch (error) {
            await rm(backupPath, { recursive: true, force: true });
            const message = error instanceof Error ? error.message : String(error);
            this.setProgress({ status: "error", message });
            return { status: "error", message };
        } finally {
            this.isBusy = false;
        }
    }

    private async rotateBackups(gameBundle: GameBundle, type: TBackupKind): Promise<void> {
        const settings = await this.repositoryService.getWorkspaceSettings();
        const limit = toRotationCount(type === "auto" ? settings.autoBackupLimit : settings.manualBackupRotationLimit);
        if (limit === null) return;
        const backups = (await scanBackups(gameBundle)).backups.filter((backup) => backup.type === type).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        await Promise.all(backups.slice(limit).map((backup) => rm(backup.path, { recursive: true, force: true })));
    }

    private scheduleSummaryRefresh(gameBundle: GameBundle): void {
        if (this.watcherRefreshTimer !== null) clearTimeout(this.watcherRefreshTimer);
        this.watcherRefreshTimer = setTimeout(() => {
            this.watcherRefreshTimer = null;
            void this.emitSummary(gameBundle);
        }, 250);
    }

    private async emitSummary(gameBundle: GameBundle): Promise<BackupSummary> {
        const summary = await scanBackups(gameBundle);
        const update: BackupSummaryUpdate = { gameBundleId: gameBundle.id, summary };
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send(Bridge.Game.backupSummaryChanged, update);
        }
        return summary;
    }

    private stopWatching(): void {
        if (this.watcherRefreshTimer !== null) {
            clearTimeout(this.watcherRefreshTimer);
            this.watcherRefreshTimer = null;
        }
        this.watcher?.close();
        this.watcher = null;
        this.watchedGameBundleId = null;
        this.watchedBackupsPath = null;
    }

    private setProgress(progress: BackupProgress): void {
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send(Bridge.Game.gameBackupProgress, progress);
        }
    }
}

async function scanBackups(gameBundle: GameBundle): Promise<BackupSummary> {
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

async function findBackup(gameBundle: GameBundle, backupId: string): Promise<BackupInstanceInfo | null> {
    return (await scanBackups(gameBundle)).backups.find((backup) => backup.id === backupId) ?? null;
}

function getBackupsPath(gameBundle: GameBundle): string {
    return join(gameBundle.userdataPath, BACKUPS_DIRECTORY_NAME);
}

function toBackupInfo(backup: BackupInstanceInfo): BackupInfo {
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

async function createZipFromDirectory(sourcePath: string, archivePath: string, onProgress: (percent: number | null) => void): Promise<void> {
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

async function copyRestoredWorld(extractedPath: string, targetWorldPath: string): Promise<void> {
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

async function pathExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}
