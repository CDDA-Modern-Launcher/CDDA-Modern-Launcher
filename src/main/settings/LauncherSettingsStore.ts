import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { app } from "electron";

import { AppTheme } from "../../shared/appearance";
import { type AutoBackupCooldown, type AutoBackupLimit, type BackupRotationLimit, DEFAULT_BACKUP_SETTINGS, isAutoBackupCooldown, isAutoBackupLimit, isBackupRotationLimit } from "../../shared/backups";
import { DEFAULT_GAME_ASSET_VARIANT, type GameAssetVariant, isGameAssetVariant, type LauncherUserSettings } from "../../shared/gameAssetVariants";

type LauncherSettings = {
    repositoryPath?: string;
    locale?: string;
    theme?: AppTheme;
    gameAssetVariant?: GameAssetVariant;
    backupsEnabled?: boolean;
    autoBackupLimit?: AutoBackupLimit;
    manualBackupRotationLimit?: BackupRotationLimit;
    autoBackupCooldown?: AutoBackupCooldown;
};

export class LauncherSettingsStore {
    private readonly filePath = join(app.getPath("userData"), "cdda.launcher.settings.json");

    async getRepositoryPath(): Promise<string | null> {
        const settings = await this.readSettings();
        return typeof settings.repositoryPath === "string" && settings.repositoryPath.trim().length > 0 ? settings.repositoryPath : null;
    }

    async setRepositoryPath(repositoryPath: string): Promise<void> {
        const settings = await this.readSettings();
        await this.writeSettings({ ...settings, repositoryPath });
    }

    async getLocale(): Promise<string | null> {
        const settings = await this.readSettings();
        return typeof settings.locale === "string" && settings.locale.trim().length > 0 ? settings.locale : null;
    }

    async setLocale(locale: string): Promise<void> {
        const settings = await this.readSettings();
        await this.writeSettings({ ...settings, locale });
    }

    async getTheme(): Promise<AppTheme> {
        const settings = await this.readSettings();
        return isAppTheme(settings.theme) ? settings.theme : "system";
    }

    async setTheme(theme: AppTheme): Promise<void> {
        const settings = await this.readSettings();
        await this.writeSettings({ ...settings, theme });
    }

    async getGameAssetVariant(): Promise<GameAssetVariant> {
        const settings = await this.readSettings();
        return isGameAssetVariant(settings.gameAssetVariant) ? settings.gameAssetVariant : DEFAULT_GAME_ASSET_VARIANT;
    }

    async setGameAssetVariant(gameAssetVariant: GameAssetVariant): Promise<void> {
        const settings = await this.readSettings();
        await this.writeSettings({ ...settings, gameAssetVariant });
    }

    async getBackupsEnabled(): Promise<boolean> {
        const settings = await this.readSettings();
        return typeof settings.backupsEnabled === "boolean" ? settings.backupsEnabled : DEFAULT_BACKUP_SETTINGS.backupsEnabled;
    }

    async setBackupsEnabled(backupsEnabled: boolean): Promise<void> {
        const settings = await this.readSettings();
        await this.writeSettings({ ...settings, backupsEnabled });
    }

    async getAutoBackupLimit(): Promise<AutoBackupLimit> {
        const settings = await this.readSettings();
        return isAutoBackupLimit(settings.autoBackupLimit) ? settings.autoBackupLimit : DEFAULT_BACKUP_SETTINGS.autoBackupLimit;
    }

    async setAutoBackupLimit(autoBackupLimit: AutoBackupLimit): Promise<void> {
        const settings = await this.readSettings();
        await this.writeSettings({ ...settings, autoBackupLimit });
    }

    async getAutoBackupCooldown(): Promise<AutoBackupCooldown> {
        const settings = await this.readSettings();
        return isAutoBackupCooldown(settings.autoBackupCooldown) ? settings.autoBackupCooldown : DEFAULT_BACKUP_SETTINGS.autoBackupCooldown;
    }

    async setAutoBackupCooldown(autoBackupCooldown: AutoBackupCooldown): Promise<void> {
        const settings = await this.readSettings();
        await this.writeSettings({ ...settings, autoBackupCooldown });
    }

    async getManualBackupRotationLimit(): Promise<BackupRotationLimit> {
        const settings = await this.readSettings();
        return isBackupRotationLimit(settings.manualBackupRotationLimit) ? settings.manualBackupRotationLimit : DEFAULT_BACKUP_SETTINGS.manualBackupRotationLimit;
    }

    async setManualBackupRotationLimit(manualBackupRotationLimit: BackupRotationLimit): Promise<void> {
        const settings = await this.readSettings();
        await this.writeSettings({ ...settings, manualBackupRotationLimit });
    }

    async getUserSettings(): Promise<LauncherUserSettings> {
        return {
            gameAssetVariant: await this.getGameAssetVariant(),
            backupsEnabled: await this.getBackupsEnabled(),
            autoBackupLimit: await this.getAutoBackupLimit(),
            manualBackupRotationLimit: await this.getManualBackupRotationLimit(),
            autoBackupCooldown: await this.getAutoBackupCooldown()
        };
    }

    private async readSettings(): Promise<LauncherSettings> {
        try {
            const content = await readFile(this.filePath, "utf8");
            const parsed: unknown = JSON.parse(content);

            if (!isLauncherSettings(parsed)) {
                return {};
            }

            return parsed;
        } catch (error) {
            if (isNodeError(error) && error.code === "ENOENT") {
                return {};
            }

            console.error("[settings] failed to read settings", error);
            return {};
        }
    }

    private async writeSettings(settings: LauncherSettings): Promise<void> {
        await mkdir(dirname(this.filePath), { recursive: true });
        await writeFile(this.filePath, `${JSON.stringify(settings, null, 4)}\n`, "utf8");
    }
}

function isLauncherSettings(value: unknown): value is LauncherSettings {
    return typeof value === "object" && value !== null;
}

function isAppTheme(value: unknown): value is AppTheme {
    return value === "system" || value === "dark" || value === "light";
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error;
}
