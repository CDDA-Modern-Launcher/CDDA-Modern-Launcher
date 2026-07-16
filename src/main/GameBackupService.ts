import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import extractZip from "extract-zip";

import { translate } from "./LocalizationService";
import { BACKUP_ARCHIVE_FILE_NAME, BACKUP_INFO_FILE_NAME } from "../shared/Const";
import { TBackupKind } from "../shared/backups/types/TBackupKind";
import { BackupInfo } from "../shared/backups/types/BackupInfo";
import { BackupProgress } from "../shared/backups/types/BackupProgress";
import { BackupSummary } from "../shared/backups/types/BackupSummary";
import { BackupSummaryUpdate } from "../shared/backups/types/BackupSummaryUpdate";
import { EBackupCreateResult } from "../shared/backups/types/EBackupCreateResult";
import { EBackupDeleteResult } from "../shared/backups/types/EBackupDeleteResult";
import { toRotationCount } from "../shared/backups/toRotationCount";
import { EBackupRestoreResult } from "../shared/backups/types/EBackupRestoreResult";

import { EBackupRenameResult } from "../shared/backups/types/EBackupRenameResult";
import { GameBundle } from "../shared/game-bundle/GameBundle";
import { pathExists } from "./utils/pathExists";
import { workspaceService } from "./WorkspaceService";
import { GameBackupContext } from "./GameBackupContext";
import { scanBackups } from "./utils/backups/scanBackups";
import { findBackup } from "./utils/backups/findBackup";
import { getBackupsPath } from "./utils/backups/getBackupsPath";
import { toBackupInfo } from "./utils/backups/toBackupInfo";
import { createZipFromDirectory } from "./utils/backups/createZipFromDirectory";
import { safePathSegment } from "./utils/safePathSegment";
import { copyRestoredWorld } from "./utils/backups/copyRestoredWorld";
import { broadcastIPC } from "./utils/broadcastIPC";
import { Bridge } from "../shared/bridge-api/Bridge";
import { broadcastBackupIPC } from "./utils/broadcastBackupIPC";
import { CreateManualBackupOptions } from "../shared/backups/types/CreateManualBackupOptions";
import { gameFileOperationGuard } from "./game/GameFileOperationGuard";
import { gameSaveCoordinator } from "./game/GameSaveCoordinator";
import { ipcMain } from "electron";

class GameBackupService {
    private isBusy = false;

    async initialize(): Promise<void> {
        ipcMain.handle(Bridge.Game.createManualBackup, async (_, options: CreateManualBackupOptions | undefined) => {
            console.info(`[backup-ipc] create manual world=${options?.worldName ?? "current"}`);
            const result = await gameFileOperationGuard.run("creating-backup", async () => {
                const context = await gameSaveCoordinator.getBackupContext((options ?? {}).worldName);
                if (context === null) return { status: "unavailable", message: translate("game.error.no.game.bundle") } as EBackupCreateResult;
                const createResult = await this.createManualBackup(context);
                if (createResult.status === "created") gameSaveCoordinator.touchAutoBackupCooldown(context.gameBundle.id, createResult.backup.worldFolderName);
                return createResult;
            });
            console.info(`[backup-ipc] create manual result=${result.status}`);
            return result;
        });

        ipcMain.handle(Bridge.Game.restoreBackup, async (_, backupId: string) => {
            console.info(`[backup-ipc] restore id=${backupId}`);
            const result = await gameFileOperationGuard.run("restoring-backup", async () => {
                const context = await gameSaveCoordinator.getBackupContext();
                if (context === null) return { status: "unavailable", message: translate("game.error.no.game.bundle") } as EBackupRestoreResult;
                const restoreResult = await this.restoreBackup(context, backupId);
                if (restoreResult.status === "restored") await gameSaveCoordinator.refreshActiveSaveSummary();
                return restoreResult;
            });
            console.info(`[backup-ipc] restore result=${result.status} id=${backupId}`);
            return result;
        });

        ipcMain.handle(Bridge.Game.deleteBackup, async (_, backupId: string) => {
            console.info(`[backup-ipc] delete id=${backupId}`);
            const result = await gameFileOperationGuard.run("deleting-backup", async () => {
                const context = await gameSaveCoordinator.getBackupContext();
                return this.deleteBackup(context?.gameBundle ?? null, backupId);
            });
            console.info(`[backup-ipc] delete result=${result.status} id=${backupId}`);
            return result;
        });

        ipcMain.handle(Bridge.Game.renameBackup, async (_, backupId: string, comment: string) => {
            console.info(`[backup-ipc] rename id=${backupId}`);
            const result = await gameFileOperationGuard.run("renaming-backup", async () => {
                const context = await gameSaveCoordinator.getBackupContext();
                return this.renameBackup(context?.gameBundle ?? null, backupId, comment);
            });
            console.info(`[backup-ipc] rename result=${result.status} id=${backupId}`);
            return result;
        });
    }

    async updateActiveGameBundle(gameBundle: GameBundle | null): Promise<void> {
        if (gameBundle !== null) await mkdir(getBackupsPath(gameBundle), { recursive: true });
    }

    async getSummary(gameBundle: GameBundle | null): Promise<BackupSummary> {
        return gameBundle === null ? { backups: [], latestBackup: null } : scanBackups(gameBundle);
    }

    async createAutoBackup(context: GameBackupContext): Promise<EBackupCreateResult> {
        if (!context.gameRunning) return { status: "unavailable", message: translate("backup.error.auto.requires.running") };
        if (this.isBusy) return { status: "blocked", message: translate("backup.error.busy") };
        const settings = workspaceService.getWorkspaceSettings();
        if (!settings.backupsEnabled || settings.autoBackupLimit === "disabled") return { status: "unavailable", message: translate("backup.error.auto.disabled") };
        return this.createBackup(context, "auto");
    }

    private async createManualBackup(context: GameBackupContext): Promise<EBackupCreateResult> {
        return this.createBackup(context, "manual");
    }

    private async restoreBackup(context: GameBackupContext, backupId: string): Promise<EBackupRestoreResult> {
        if (context.gameRunning) return { status: "blocked", message: translate("backup.error.restore.blocked.running") };
        if (this.isBusy) return { status: "blocked", message: translate("backup.error.busy") };
        const backup = await findBackup(context.gameBundle, backupId);
        if (backup === null) return { status: "unavailable", message: translate("backup.error.not.found") };
        const savePath = join(context.gameBundle.userdataPath, "save");
        const worldPath = join(savePath, backup.worldFolderName);
        const tempPath = `${worldPath}.restore-${Date.now()}`;

        this.isBusy = true;
        this.setProgress({ status: "restoring", backupId, percent: null }, true);
        try {
            await rm(tempPath, { recursive: true, force: true });
            await mkdir(dirname(tempPath), { recursive: true });
            await extractZip(backup.archivePath, { dir: tempPath });
            await rm(worldPath, { recursive: true, force: true });
            await mkdir(savePath, { recursive: true });
            await copyRestoredWorld(tempPath, worldPath);
            await rm(tempPath, { recursive: true, force: true });
            this.setProgress({ status: "completed" }, true);
            queueMicrotask(() => this.setProgress({ status: "idle" }, true));
            await this.emitSummary(context.gameBundle);
            return { status: "restored" };
        } catch (error) {
            await rm(tempPath, { recursive: true, force: true });
            const message = error instanceof Error ? error.message : String(error);
            this.setProgress({ status: "error", message }, true);
            return { status: "error", message };
        } finally {
            this.isBusy = false;
        }
    }

    private async deleteBackup(gameBundle: GameBundle | null, backupId: string): Promise<EBackupDeleteResult> {
        if (gameBundle === null) return { status: "unavailable", message: translate("game.error.no.game.bundle") };
        const backup = await findBackup(gameBundle, backupId);
        if (backup === null) return { status: "unavailable", message: translate("backup.error.not.found") };
        await rm(backup.path, { recursive: true, force: true });
        await this.emitSummary(gameBundle);
        return { status: "deleted" };
    }

    private async renameBackup(gameBundle: GameBundle | null, backupId: string, comment: string): Promise<EBackupRenameResult> {
        if (gameBundle === null) return { status: "unavailable", message: translate("game.error.no.game.bundle") };
        const backup = await findBackup(gameBundle, backupId);
        if (backup === null) return { status: "unavailable", message: translate("backup.error.not.found") };
        const updated: BackupInfo = { ...toBackupInfo(backup), comment: comment.trim(), type: "manual" };
        await writeFile(join(backup.path, BACKUP_INFO_FILE_NAME), `${JSON.stringify(updated, null, 2)}\n`, "utf8");
        const summary = await this.emitSummary(gameBundle);
        const renamed = summary.backups.find((candidate) => candidate.id === backupId);
        return renamed === undefined ? { status: "unavailable", message: translate("backup.error.not.found") } : { status: "renamed", backup: renamed };
    }

    private async createBackup(context: GameBackupContext, type: TBackupKind): Promise<EBackupCreateResult> {
        const settings = await workspaceService.getWorkspaceSettings();
        if (!settings.backupsEnabled) return { status: "unavailable", message: translate("backup.error.disabled") };
        if (!context.savesStable) return { status: "blocked", message: translate("backup.error.saves.changing") };
        if (this.isBusy) return { status: "blocked", message: translate("backup.error.busy") };
        const world = context.saves?.currentWorld ?? null;
        if (world === null || world.characterName === null) return { status: "unavailable", message: translate("backup.error.world.and.character.missing") };
        const sourceWorldPath = join(context.gameBundle.userdataPath, "save", world.folderName);
        if (!(await pathExists(sourceWorldPath))) return { status: "unavailable", message: translate("backup.error.world.folder.missing") };

        const id = `${new Date().toISOString().replace(/[.:]/g, "-")}-${type}`;
        const backupPath = join(getBackupsPath(context.gameBundle), safePathSegment(id, "backup"));
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
            this.setProgress({ status: "completed" }, true);
            queueMicrotask(() => this.setProgress({ status: "idle" }, true));
            return backup === undefined ? { status: "error", message: translate("backup.error.created.backup.missing") } : { status: "created", backup };
        } catch (error) {
            await rm(backupPath, { recursive: true, force: true });
            const message = error instanceof Error ? error.message : String(error);
            this.setProgress({ status: "error", message }, true);
            return { status: "error", message };
        } finally {
            this.isBusy = false;
        }
    }

    private async rotateBackups(gameBundle: GameBundle, type: TBackupKind): Promise<void> {
        const settings = workspaceService.getWorkspaceSettings();
        const limit = toRotationCount(type === "auto" ? settings.autoBackupLimit : settings.manualBackupRotationLimit);
        if (limit === null) return;
        const backups = (await scanBackups(gameBundle)).backups.filter((backup) => backup.type === type).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        await Promise.all(backups.slice(limit).map((backup) => rm(backup.path, { recursive: true, force: true })));
    }

    private async emitSummary(gameBundle: GameBundle): Promise<BackupSummary> {
        const summary = await scanBackups(gameBundle);
        const update: BackupSummaryUpdate = { gameBundleId: gameBundle.id, summary };
        console.info(`[backup-ipc] publish summary gameBundleId=${gameBundle.id} count=${summary.backups.length}`);
        broadcastIPC(Bridge.Game.backupSummaryChanged, update);
        return summary;
    }

    private setProgress(progress: BackupProgress, immediate = false): void {
        broadcastBackupIPC(progress, immediate);
    }
}

export const gameBackupService = new GameBackupService();
