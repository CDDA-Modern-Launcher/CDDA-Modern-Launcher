import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { app } from "electron";

import { TAppThemeSource } from "../../shared/appearance/TAppThemeSource";
import { isNodeError } from "../utils/isNodeError";

const WRITE_DEBOUNCE_MS = 250;

// Keep only application-level settings that are required before a repository is ready.
// Repository-specific settings belong to cdda.launcher.config.jsonc inside the selected repository.
interface Settings {
    repositoryPath?: string;
    locale?: string;
    theme?: TAppThemeSource;
}

const DEFAULT_SETTINGS: Settings = {
    repositoryPath: "",
    locale: "",
    theme: "system"
};

class AppSettings {
    private readonly filePath = join(app.getPath("userData"), "cdda.launcher.settings.json");
    private settings: Settings | null = null;
    private writeTimer: ReturnType<typeof setTimeout> | null = null;
    private writeQueue: Promise<void> = Promise.resolve();

    async initialize(): Promise<void> {
        let content: string;

        try {
            content = await readFile(this.filePath, "utf8");
        } catch (error) {
            if (isNodeError(error) && error.code === "ENOENT") {
                this.update(DEFAULT_SETTINGS);
                return;
            }

            console.error("[settings] failed to read settings", error);
            this.settings = { ...DEFAULT_SETTINGS };
            return;
        }

        let parsed: unknown;

        try {
            parsed = JSON.parse(content);
        } catch (error) {
            console.warn("[settings] invalid JSON, resetting", error);
            this.update(DEFAULT_SETTINGS);
            return;
        }

        if (!this.isRecord(parsed)) {
            console.warn("[settings] invalid settings file, resetting");
            this.update(DEFAULT_SETTINGS);
            return;
        }

        const finalSettings: Settings = {
            repositoryPath: typeof parsed.repositoryPath === "string" && parsed.repositoryPath.trim().length > 0 ? parsed.repositoryPath : "",
            locale: typeof parsed.locale === "string" && parsed.locale.trim().length > 0 ? parsed.locale : "",
            theme: this.isThemeSource(parsed.theme) ? parsed.theme : "system"
        };

        this.settings = finalSettings;

        if (JSON.stringify(finalSettings) !== JSON.stringify(parsed)) {
            this.update(finalSettings);
        }
    }

    get<K extends keyof Settings>(key: K): NonNullable<Settings[K]> {
        if (!this.settings) throw new Error("App settings is not initialized");
        const value = this.settings[key];
        if (value === null || value === undefined) throw new Error(`App setting "${String(key)}" is not initialized`);
        return value as NonNullable<Settings[K]>;
    }

    set<K extends keyof Settings>(patch: { [P in K]: NonNullable<Settings[P]> }): void {
        this.update(patch);
    }

    private update(patch: Settings): void {
        this.settings = { ...this.settings, ...patch };

        if (this.writeTimer !== null) {
            clearTimeout(this.writeTimer);
        }

        this.writeTimer = setTimeout(() => {
            this.writeTimer = null;
            const snapshot = this.settings ?? {};
            this.writeQueue = this.writeQueue.then(() => this.write(snapshot)).catch((error: unknown) => console.error("[settings] failed to write settings", error));
        }, WRITE_DEBOUNCE_MS);
    }

    private async write(settings: Settings): Promise<void> {
        await mkdir(dirname(this.filePath), { recursive: true });
        await writeFile(this.filePath, `${JSON.stringify(settings, null, 4)}\n`, "utf8");
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }

    private isThemeSource(value: unknown): value is TAppThemeSource {
        return value === "system" || value === "light" || value === "dark";
    }
}

export const appSettings = new AppSettings();
