export const BACKUPS_DIRECTORY_NAME = "backups";
export const BACKUP_INFO_FILE_NAME = "backup.json";
export const BACKUP_ARCHIVE_FILE_NAME = "world.zip";

export type BackupKind = "manual" | "auto";

export type BackupRotationLimit = "disabled" | "3" | "5" | "10";
export type AutoBackupLimit = "disabled" | "3" | "5" | "10";
export type AutoBackupCooldown = "disabled" | "5s" | "15s" | "1m";

export type GameBackupInfo = {
    schemaVersion: 1;
    id: string;
    worldName: string;
    worldFolderName: string;
    characterName: string;
    platformId: string;
    gameVersion: string;
    createdAt: string;
    type: BackupKind;
    comment: string;
};

export type GameBackup = GameBackupInfo & {
    path: string;
    archivePath: string;
};

export type GameBackupProgress =
    | { status: "idle" }
    | { status: "creating"; percent: number | null; worldName: string; characterName: string; type: BackupKind }
    | { status: "restoring"; backupId: string; percent: number | null }
    | { status: "completed"; message?: string }
    | { status: "error"; message: string };

export type GameBackupSummary = {
    backups: GameBackup[];
    latestBackup: GameBackup | null;
};

export type GameBackupSummaryUpdate = {
    installId: string;
    summary: GameBackupSummary;
};

export type CreateGameBackupOptions = {
    type: BackupKind;
};

export type CreateGameBackupResult = { status: "created"; summary: GameBackupSummary; backup: GameBackup } | { status: "unavailable" | "blocked" | "error"; message: string };
export type RestoreGameBackupResult = { status: "restored"; summary: GameBackupSummary } | { status: "unavailable" | "blocked" | "error"; message: string };
export type DeleteGameBackupResult = { status: "deleted"; summary: GameBackupSummary } | { status: "unavailable" | "error"; message: string };
export type RenameGameBackupResult = { status: "renamed"; summary: GameBackupSummary; backup: GameBackup } | { status: "unavailable" | "error"; message: string };

export type LauncherBackupSettings = {
    backupsEnabled: boolean;
    autoBackupLimit: AutoBackupLimit;
    manualBackupRotationLimit: BackupRotationLimit;
    autoBackupCooldown: AutoBackupCooldown;
};

export const DEFAULT_BACKUP_SETTINGS: LauncherBackupSettings = {
    backupsEnabled: true,
    autoBackupLimit: "5",
    manualBackupRotationLimit: "disabled",
    autoBackupCooldown: "15s"
};

export function isAutoBackupLimit(value: unknown): value is AutoBackupLimit {
    return value === "disabled" || value === "3" || value === "5" || value === "10";
}

export function isBackupRotationLimit(value: unknown): value is BackupRotationLimit {
    return value === "disabled" || value === "3" || value === "5" || value === "10";
}

export function isAutoBackupCooldown(value: unknown): value is AutoBackupCooldown {
    return value === "disabled" || value === "5s" || value === "15s" || value === "1m";
}

export function toRotationCount(value: AutoBackupLimit | BackupRotationLimit): number | null {
    return value === "disabled" ? null : Number(value);
}

export function toAutoBackupCooldownMs(value: AutoBackupCooldown): number {
    switch (value) {
        case "disabled":
            return 0;
        case "5s":
            return 5_000;
        case "15s":
            return 15_000;
        case "1m":
            return 60_000;
    }
}
