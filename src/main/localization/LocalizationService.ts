import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { app, BrowserWindow } from "electron";

import {
    DEFAULT_LOCALE,
    LocaleFile,
    LocaleMessages,
    LocaleOption,
    LocalizationBundle,
    REPOSITORY_LOCALES_DIRECTORY
} from "../../shared/localization";
import { LauncherSettingsStore } from "../settings/LauncherSettingsStore";
import builtInEn from "./locales/en.json";
import builtInRu from "./locales/ru.json";

const BUILT_IN_LOCALES = [builtInEn, builtInRu].filter(isLocaleFile);

type LoadedLocale = LocaleFile & {
    source: "built-in" | "repository";
};

type FormatVariables = Record<string, string | number>;

export class LocalizationService {
    private readonly builtInLocales = new Map<string, LoadedLocale>();
    private readonly repositoryLocales = new Map<string, LoadedLocale>();
    private selectedLocale = DEFAULT_LOCALE;
    private repositoryPath: string | null = null;

    constructor(private readonly settingsStore: LauncherSettingsStore) {
        for (const locale of BUILT_IN_LOCALES) {
            this.builtInLocales.set(normalizeLocale(locale.locale), { ...locale, locale: normalizeLocale(locale.locale), source: "built-in" });
        }
    }

    async initialize(): Promise<void> {
        this.repositoryPath = await this.settingsStore.getRepositoryPath();
        await this.reloadRepositoryLocales();

        const savedLocale = await this.settingsStore.getLocale();
        this.selectedLocale = this.resolveInitialLocale(savedLocale);
    }

    async setRepositoryPath(repositoryPath: string): Promise<void> {
        this.repositoryPath = repositoryPath;
        await this.reloadRepositoryLocales();

        if (!this.hasLocale(this.selectedLocale)) {
            this.selectedLocale = this.resolveInitialLocale(await this.settingsStore.getLocale());
            this.broadcast();
        } else {
            this.broadcast();
        }
    }

    getBundle(): LocalizationBundle {
        const effectiveLocale = this.resolveEffectiveLocale(this.selectedLocale);
        const fallback = this.getRequiredBuiltInLocale(DEFAULT_LOCALE);
        const selected = this.getLocaleWithPriority(effectiveLocale) ?? fallback;

        return {
            selectedLocale: this.selectedLocale,
            effectiveLocale,
            fallbackLocale: DEFAULT_LOCALE,
            options: this.getOptions(),
            messages: mergeMessages(fallback.messages, this.getBuiltInLocale(effectiveLocale)?.messages, selected.messages)
        };
    }

    async setLocale(locale: string): Promise<LocalizationBundle> {
        this.selectedLocale = normalizeLocale(locale);
        await this.settingsStore.setLocale(this.selectedLocale);
        const bundle = this.getBundle();
        this.broadcast(bundle);
        return bundle;
    }

    t(key: string, variables: FormatVariables = {}): string {
        const value = this.getBundle().messages[key] ?? key;
        return formatMessage(value, variables);
    }

    private async reloadRepositoryLocales(): Promise<void> {
        this.repositoryLocales.clear();

        if (this.repositoryPath === null) {
            return;
        }

        const localeDirectory = join(this.repositoryPath, REPOSITORY_LOCALES_DIRECTORY);
        let fileNames: string[];

        try {
            fileNames = await readdir(localeDirectory);
        } catch (error) {
            if (isNodeError(error) && error.code === "ENOENT") {
                return;
            }

            console.error("[localization] failed to read repository locales", error);
            return;
        }

        for (const fileName of fileNames.filter((name) => name.toLowerCase().endsWith(".json"))) {
            const filePath = join(localeDirectory, fileName);

            try {
                const content = await readFile(filePath, "utf8");
                const parsed: unknown = JSON.parse(content);

                if (!isLocaleFile(parsed)) {
                    console.error(`[localization] invalid locale file: ${filePath}`);
                    continue;
                }

                const locale = normalizeLocale(parsed.locale);
                this.repositoryLocales.set(locale, { ...parsed, locale, source: "repository" });
            } catch (error) {
                console.error(`[localization] failed to load locale file: ${filePath}`, error);
            }
        }
    }

    private resolveInitialLocale(savedLocale: string | null): string {
        const normalizedSavedLocale = savedLocale === null ? null : normalizeLocale(savedLocale);

        if (normalizedSavedLocale !== null && this.hasLocale(normalizedSavedLocale)) {
            return normalizedSavedLocale;
        }

        const systemLocale = normalizeLocale(app.getLocale());

        if (this.hasLocale(systemLocale)) {
            return systemLocale;
        }

        const systemLanguage = systemLocale.split("-")[0];

        if (this.hasLocale(systemLanguage)) {
            return systemLanguage;
        }

        return DEFAULT_LOCALE;
    }

    private resolveEffectiveLocale(locale: string): string {
        const normalized = normalizeLocale(locale);

        if (this.hasLocale(normalized)) {
            return normalized;
        }

        const language = normalized.split("-")[0];

        if (this.hasLocale(language)) {
            return language;
        }

        return DEFAULT_LOCALE;
    }

    private getOptions(): LocaleOption[] {
        const locales = new Map<string, LoadedLocale>();

        for (const [locale, file] of this.builtInLocales) {
            locales.set(locale, file);
        }

        for (const [locale, file] of this.repositoryLocales) {
            locales.set(locale, file);
        }

        return [...locales.values()]
            .map((locale) => ({
                locale: locale.locale,
                name: locale.name,
                nativeName: locale.nativeName,
                iconPng: locale.iconPng,
                source: locale.source
            }))
            .sort((a, b) => a.nativeName.localeCompare(b.nativeName));
    }

    private getLocaleWithPriority(locale: string): LoadedLocale | null {
        return this.repositoryLocales.get(locale) ?? this.builtInLocales.get(locale) ?? null;
    }

    private getBuiltInLocale(locale: string): LoadedLocale | null {
        return this.builtInLocales.get(locale) ?? null;
    }

    private getRequiredBuiltInLocale(locale: string): LoadedLocale {
        const file = this.builtInLocales.get(locale);

        if (file === undefined) {
            throw new Error(`Built-in locale is missing: ${locale}`);
        }

        return file;
    }

    private hasLocale(locale: string): boolean {
        return this.repositoryLocales.has(locale) || this.builtInLocales.has(locale);
    }

    private broadcast(bundle = this.getBundle()): void {
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send("localization:changed", bundle);
        }
    }
}

function mergeMessages(...sources: Array<LocaleMessages | undefined>): LocaleMessages {
    return Object.assign({}, ...sources.filter((source): source is LocaleMessages => source !== undefined));
}

function normalizeLocale(locale: string): string {
    return locale.trim().replace("_", "-").toLowerCase();
}

function formatMessage(message: string, variables: FormatVariables): string {
    return message.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, key: string) => {
        const value = variables[key];
        return value === undefined ? match : String(value);
    });
}

function isLocaleFile(value: unknown): value is LocaleFile {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidate = value as Partial<LocaleFile>;
    return (
        candidate.schemaVersion === 1 &&
        typeof candidate.locale === "string" &&
        candidate.locale.trim().length > 0 &&
        typeof candidate.name === "string" &&
        typeof candidate.nativeName === "string" &&
        typeof candidate.iconPng === "string" &&
        candidate.iconPng.startsWith("data:image/png;base64,") &&
        typeof candidate.messages === "object" &&
        candidate.messages !== null &&
        Object.values(candidate.messages).every((message) => typeof message === "string")
    );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error;
}
