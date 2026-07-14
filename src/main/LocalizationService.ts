import { app, BrowserWindow, ipcMain } from "electron";

import { appSettings } from "./settings/AppSettings";
import { LocaleOption } from "../shared/localization/types/LocaleOption";
import { LocalizationBundle } from "../shared/localization/types/LocalizationBundle";
import { FormatArgs } from "../shared/FormatArgs";
import { mergeMessages } from "../shared/localization/mergeMessages";
import { formatMessage } from "../shared/formatMessage";
import { Bridge } from "../shared/bridge-api/Bridge";
import { EN_LOCALE } from "../shared/localization/locales/en";
import { RU_LOCALE } from "../shared/localization/locales/ru";
import { LocaleFile } from "../shared/localization/types/LocaleFile";
import { LocaleMessages } from "../shared/localization/types/LocaleMessages";

const FALLBACK_LOCALE = EN_LOCALE.locale;
const BUILT_IN_LOCALES: LocaleFile[] = [EN_LOCALE, RU_LOCALE];

class LocalizationService {
    private readonly locales = new Map<string, LocaleFile>();
    private readonly messages = new Map<string, LocaleMessages>();
    private options: LocaleOption[] = [];
    private locale = FALLBACK_LOCALE;
    private initialized = false;

    constructor() {
        for (const locale of BUILT_IN_LOCALES) {
            this.locales.set(normalizeLocale(locale.locale), locale);
        }

        const fallbackMessages = this.getRequiredLocale(FALLBACK_LOCALE).messages;

        for (const [locale, file] of this.locales) {
            this.messages.set(locale, mergeMessages(fallbackMessages, file.messages));
        }

        ipcMain.handle(Bridge.Localization.getBundle, (): LocalizationBundle => this.getBundle());
        ipcMain.handle(Bridge.Localization.setLocale, (_event, locale: string): LocalizationBundle => this.setLocale(locale));
    }

    initialize(): void {
        if (this.initialized) return;

        const systemLocale = this.resolveSystemLocale();

        this.options = [...this.locales.values()]
            .map(({ locale, nativeName, iconPng }) => ({
                locale,
                nativeName,
                iconPng,
                isSystem: locale === systemLocale
            }))
            .sort((left, right) => compareLocaleOptions(left, right, systemLocale));

        const savedLocale = normalizeLocale(appSettings.get("locale"));
        this.locale = this.hasLocale(savedLocale) ? savedLocale : systemLocale;

        if (savedLocale !== this.locale) {
            appSettings.set({ locale: this.locale });
        }

        this.initialized = true;
    }

    getBundle(): LocalizationBundle {
        return {
            locale: this.locale,
            options: this.options,
            messages: this.getMessages(this.locale)
        };
    }

    setLocale(locale: string): LocalizationBundle {
        const normalized = normalizeLocale(locale);
        if (!this.hasLocale(normalized)) throw new Error(`Unsupported locale: ${locale}`);
        if (normalized === this.locale) return this.getBundle();

        this.locale = normalized;
        appSettings.set({ locale: this.locale });

        const bundle = this.getBundle();
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send(Bridge.Localization.onChanged, bundle);
        }
        return bundle;
    }

    translate(key: string, variables: FormatArgs = {}): string {
        const value = this.getMessages(this.locale)[key] ?? key;
        return formatMessage(value, variables);
    }

    private resolveSystemLocale(): string {
        const systemLocale = normalizeLocale(app.getLocale());
        if (this.hasLocale(systemLocale)) return systemLocale;

        const systemLanguage = systemLocale.split("-")[0];
        return this.hasLocale(systemLanguage) ? systemLanguage : FALLBACK_LOCALE;
    }

    private getMessages(locale: string): LocaleMessages {
        const messages = this.messages.get(locale);
        if (messages === undefined) throw new Error(`Locale messages are missing: ${locale}`);
        return messages;
    }

    private getRequiredLocale(locale: string): LocaleFile {
        const file = this.locales.get(locale);
        if (file === undefined) throw new Error(`Locale is missing: ${locale}`);
        return file;
    }

    private hasLocale(locale: string): boolean {
        return this.locales.has(locale);
    }
}

function normalizeLocale(locale: string): string {
    return locale.trim().replaceAll("_", "-").toLowerCase();
}

function compareLocaleOptions(left: LocaleOption, right: LocaleOption, systemLocale: string): number {
    const leftRank = getLocaleRank(left.locale, systemLocale);
    const rightRank = getLocaleRank(right.locale, systemLocale);

    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.nativeName.localeCompare(right.nativeName);
}

function getLocaleRank(locale: string, systemLocale: string): number {
    if (locale === systemLocale) return 0;
    if (locale === FALLBACK_LOCALE) return 1;
    return 2;
}

export const l10n = new LocalizationService();
export const translate = l10n.translate.bind(l10n);
