import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { app, BrowserWindow } from "electron";

import { LauncherSettingsStore } from "../settings/LauncherSettingsStore";
import { DEFAULT_LOCALE, REPOSITORY_LOCALES_DIRECTORY } from "../../shared/Const";
import { LocaleOption } from "../../shared/localization/types/LocaleOption";
import { LocalizationBundle } from "../../shared/localization/types/LocalizationBundle";
import { LoadedLocale } from "../../shared/localization/types/LoadedLocale";
import { FormatArgs } from "../../shared/FormatArgs";
import { BUILT_IN_LOCALES } from "../../shared/localization/BUILT_IN_LOCALES";
import { toLoadedLocale } from "../../shared/localization/toLoadedLocale";
import { toBuiltInLocaleExampleFile } from "../../shared/localization/toBuiltInLocaleExampleFile";
import { mergeMessages } from "../../shared/localization/mergeMessages";
import { normalizeLocale } from "../../shared/localization/normalizeLocale";
import { formatMessage } from "../../shared/formatMessage";
import { isLocaleFile } from "../../shared/localization/isLocaleFile";
import { isBuiltInLocaleExampleFile } from "../../shared/localization/isBuiltInLocaleExampleFile";

export class LocalizationService {
    private readonly builtInLocales = new Map<string, LoadedLocale>();
    private readonly repositoryLocales = new Map<string, LoadedLocale>();
    private selectedLocale = DEFAULT_LOCALE;
    private repositoryPath: string | null = null;

    constructor(private readonly settingsStore: LauncherSettingsStore) {
        for (const locale of BUILT_IN_LOCALES) {
            const normalizedLocale = normalizeLocale(locale.locale);
            this.builtInLocales.set(normalizedLocale, toLoadedLocale(locale, normalizedLocale, "built-in"));
        }
    }

    async initialize(): Promise<void> {
        this.repositoryPath = await this.settingsStore.getRepositoryPath();
        await this.ensureRepositoryLocales();
        await this.reloadRepositoryLocales();

        const savedLocale = await this.settingsStore.getLocale();
        this.selectedLocale = this.resolveInitialLocale(savedLocale);
    }

    async setRepositoryPath(repositoryPath: string): Promise<void> {
        this.repositoryPath = repositoryPath;
        await this.ensureRepositoryLocales();
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

    t(key: string, variables: FormatArgs = {}): string {
        const value = this.getBundle().messages[key] ?? key;
        return formatMessage(value, variables);
    }

    private async ensureRepositoryLocales(): Promise<void> {
        if (this.repositoryPath === null) {
            return;
        }

        if (!(await isExistingDirectory(this.repositoryPath))) {
            return;
        }

        const localeDirectory = join(this.repositoryPath, REPOSITORY_LOCALES_DIRECTORY);

        try {
            await mkdir(localeDirectory, { recursive: true });
        } catch (error) {
            console.error("[localization] failed to create repository locales directory", error);
            return;
        }

        for (const locale of this.builtInLocales.values()) {
            const targetPath = join(localeDirectory, `${locale.locale}.json`);

            try {
                await writeFile(targetPath, `${JSON.stringify(toBuiltInLocaleExampleFile(locale), null, 2)}\n`, "utf8");
            } catch (error) {
                console.error(`[localization] failed to copy built-in locale example to repository: ${targetPath}`, error);
            }
        }
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

                if (isBuiltInLocaleExampleFile(parsed)) {
                    continue;
                }

                if (!isLocaleFile(parsed)) {
                    console.error(`[localization] invalid locale file: ${filePath}`);
                    continue;
                }

                const locale = normalizeLocale(parsed.locale);
                this.repositoryLocales.set(locale, toLoadedLocale(parsed, locale, "repository"));
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

async function isExistingDirectory(path: string): Promise<boolean> {
    try {
        return (await stat(path)).isDirectory();
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return false;
        throw error;
    }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error;
}
