import { createWriteStream, type FSWatcher, watch } from "node:fs";
import { access, copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, sep } from "node:path";
import { finished } from "node:stream/promises";

import extractZip from "extract-zip";

import type { LocalizationService } from "../localization/LocalizationService";
import type { LocalRepositoryService } from "../repository/LocalRepositoryService";
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
import { Distributive } from "../../shared/distributive/Distributive";
import { GameSaveSummary } from "../../shared/GameSaveSummary";

export type GameBackupContext = {
    install: Distributive;
    saves: GameSaveSummary | null;
    gameRunning: boolean;
    savesStable: boolean;
};

export class GameBackupService {
    private progress: BackupProgress = { status: "idle" };
    private readonly progressListeners = new Set<(progress: BackupProgress) => void>();
    private readonly summaryListeners = new Set<(update: BackupSummaryUpdate) => void>();
    private watcher: FSWatcher | null = null;
    private watchedInstallId: string | null = null;
    private watchedBackupsPath: string | null = null;
    private watcherRefreshTimer: NodeJS.Timeout | null = null;
    private isBusy = false;

    constructor(
        private readonly repositoryService: LocalRepositoryService,
        private readonly localizationService: LocalizationService
    ) {}

    onProgress(listener: (progress: BackupProgress) => void): () => void {
        this.progressListeners.add(listener);
        listener(this.progress);
        return () => this.progressListeners.delete(listener);
    }

    onSummaryChanged(listener: (update: BackupSummaryUpdate) => void): () => void {
        this.summaryListeners.add(listener);
        return () => this.summaryListeners.delete(listener);
    }

    async updateActiveInstall(install: Distributive | null): Promise<void> {
        if (install === null) {
            this.stopWatching();
            return;
        }

        const backupsPath = getBackupsPath(install);
        if (this.watchedInstallId === install.id && this.watchedBackupsPath === backupsPath) return;
        this.stopWatching();
        this.watchedInstallId = install.id;
        this.watchedBackupsPath = backupsPath;
        await mkdir(backupsPath, { recursive: true });
        this.watcher = watch(backupsPath, { persistent: false }, () => this.scheduleSummaryRefresh(install));
    }

    async getSummary(install: Distributive | null): Promise<BackupSummary> {
        return install === null ? { backups: [], latestBackup: null } : scanBackups(install);
    }

    async createManualBackup(context: GameBackupContext): Promise<EBackupCreateResult> {
        return this.createBackup(context, "manual");
    }

    async createAutoBackup(context: GameBackupContext): Promise<EBackupCreateResult> {
        if (!context.gameRunning) return { status: "unavailable", message: this.t("backup.error.autoRequiresRunning") };
        if (this.isBusy) return { status: "blocked", message: this.t("backup.error.busy") };
        const settings = await this.repositoryService.getUserSettings();
        if (!settings.backupsEnabled || settings.autoBackupLimit === "disabled") return { status: "unavailable", message: this.t("backup.error.autoDisabled") };
        return this.createBackup(context, "auto");
    }

    async restoreBackup(context: GameBackupContext, backupId: string): Promise<EBackupRestoreResult> {
        if (context.gameRunning) return { status: "blocked", message: this.t("backup.error.restoreBlockedRunning") };
        if (this.isBusy) return { status: "blocked", message: this.t("backup.error.busy") };
        const backup = await findBackup(context.install, backupId);
        if (backup === null) return { status: "unavailable", message: this.t("backup.error.notFound") };
        const savePath = join(context.install.userdataPath, "save");
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
            const summary = await this.emitSummary(context.install);
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

    async deleteBackup(install: Distributive | null, backupId: string): Promise<EBackupDeleteResult> {
        if (install === null) return { status: "unavailable", message: this.t("game.error.notInstalled") };
        const backup = await findBackup(install, backupId);
        if (backup === null) return { status: "unavailable", message: this.t("backup.error.notFound") };
        await rm(backup.path, { recursive: true, force: true });
        return { status: "deleted", summary: await this.emitSummary(install) };
    }

    async renameBackup(install: Distributive | null, backupId: string, comment: string): Promise<EBackupRenameResult> {
        if (install === null) return { status: "unavailable", message: this.t("game.error.notInstalled") };
        const backup = await findBackup(install, backupId);
        if (backup === null) return { status: "unavailable", message: this.t("backup.error.notFound") };
        const updated: BackupInfo = { ...toBackupInfo(backup), comment: comment.trim(), type: "manual" };
        await writeFile(join(backup.path, BACKUP_INFO_FILE_NAME), `${JSON.stringify(updated, null, 2)}\n`, "utf8");
        const summary = await this.emitSummary(install);
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
        const settings = await this.repositoryService.getUserSettings();
        if (!settings.backupsEnabled) return { status: "unavailable", message: this.t("backup.error.disabled") };
        if (!context.savesStable) return { status: "blocked", message: this.t("backup.error.savesChanging") };
        if (this.isBusy) return { status: "blocked", message: this.t("backup.error.busy") };
        const world = context.saves?.currentWorld ?? null;
        if (world === null || world.characterName === null) return { status: "unavailable", message: this.t("backup.error.worldAndCharacterMissing") };
        const sourceWorldPath = join(context.install.userdataPath, "save", world.folderName);
        if (!(await pathExists(sourceWorldPath))) return { status: "unavailable", message: this.t("backup.error.worldFolderMissing") };

        const id = `${new Date().toISOString().replace(/[.:]/g, "-")}-${type}`;
        const backupPath = join(getBackupsPath(context.install), safePathSegment(id));
        const archivePath = join(backupPath, BACKUP_ARCHIVE_FILE_NAME);
        const info: BackupInfo = {
            schemaVersion: 1,
            id,
            worldName: world.name,
            worldFolderName: world.folderName,
            characterName: world.characterName,
            platformId: context.install.manifest.channelId,
            gameVersion: context.install.manifest.releaseName || context.install.manifest.releaseId,
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
            await this.rotateBackups(context.install, type);
            const summary = await this.emitSummary(context.install);
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

    private async rotateBackups(install: Distributive, type: TBackupKind): Promise<void> {
        const settings = await this.repositoryService.getUserSettings();
        const limit = toRotationCount(type === "auto" ? settings.autoBackupLimit : settings.manualBackupRotationLimit);
        if (limit === null) return;
        const backups = (await scanBackups(install)).backups.filter((backup) => backup.type === type).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        await Promise.all(backups.slice(limit).map((backup) => rm(backup.path, { recursive: true, force: true })));
    }

    private scheduleSummaryRefresh(install: Distributive): void {
        if (this.watcherRefreshTimer !== null) clearTimeout(this.watcherRefreshTimer);
        this.watcherRefreshTimer = setTimeout(() => {
            this.watcherRefreshTimer = null;
            void this.emitSummary(install);
        }, 250);
    }

    private async emitSummary(install: Distributive): Promise<BackupSummary> {
        const summary = await scanBackups(install);
        const update: BackupSummaryUpdate = { installId: install.id, summary };
        for (const listener of this.summaryListeners) listener(update);
        return summary;
    }

    private stopWatching(): void {
        if (this.watcherRefreshTimer !== null) {
            clearTimeout(this.watcherRefreshTimer);
            this.watcherRefreshTimer = null;
        }
        this.watcher?.close();
        this.watcher = null;
        this.watchedInstallId = null;
        this.watchedBackupsPath = null;
    }

    private setProgress(progress: BackupProgress): void {
        this.progress = progress;
        for (const listener of this.progressListeners) listener(progress);
    }
}

async function scanBackups(install: Distributive): Promise<BackupSummary> {
    const backupsPath = getBackupsPath(install);
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

async function findBackup(install: Distributive, backupId: string): Promise<BackupInstanceInfo | null> {
    return (await scanBackups(install)).backups.find((backup) => backup.id === backupId) ?? null;
}

function getBackupsPath(install: Distributive): string {
    return join(install.userdataPath, BACKUPS_DIRECTORY_NAME);
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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error;
}
