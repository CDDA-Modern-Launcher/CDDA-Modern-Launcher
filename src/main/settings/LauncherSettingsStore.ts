import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { app } from "electron";

type LauncherSettings = {
    repositoryPath?: string;
    locale?: string;
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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error;
}
