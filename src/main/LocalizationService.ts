import { app, BrowserWindow } from "electron";

import { AppSettings } from "./settings/AppSettings";
import { DEFAULT_LOCALE } from "../shared/Const";
import { LocaleOption } from "../shared/localization/types/LocaleOption";
import { LocalizationBundle } from "../shared/localization/types/LocalizationBundle";
import { LoadedLocale } from "../shared/localization/types/LoadedLocale";
import { FormatArgs } from "../shared/FormatArgs";
import { BUILT_IN_LOCALES } from "../shared/localization/BUILT_IN_LOCALES";
import { mergeMessages } from "../shared/localization/mergeMessages";
import { formatMessage } from "../shared/formatMessage";
import { Bridge } from "../shared/bridge-api/Bridge";

export class LocalizationService {
    private readonly builtInLocales = new Map<string, LoadedLocale>();
    private selectedLocale = DEFAULT_LOCALE;

    constructor(private readonly settingsStore: AppSettings) {
        for (const locale of BUILT_IN_LOCALES) {
            this.builtInLocales.set(this.normalizeLocale(locale.locale), locale);
        }
    }

    initialize(): void {
        const savedLocale = this.settingsStore.get("locale");
        this.selectedLocale = this.resolveInitialLocale(savedLocale);
    }

    getBundle(): LocalizationBundle {
        const effectiveLocale = this.resolveEffectiveLocale(this.selectedLocale);
        const fallback = this.getRequiredBuiltInLocale(DEFAULT_LOCALE);
        const selected = this.getBuiltInLocale(effectiveLocale) ?? fallback;

        return {
            selectedLocale: this.selectedLocale,
            effectiveLocale,
            fallbackLocale: DEFAULT_LOCALE,
            options: this.getOptions(),
            messages: mergeMessages(fallback.messages, selected.messages)
        };
    }

    setLocale(locale: string): LocalizationBundle {
        this.selectedLocale = this.normalizeLocale(locale);
        this.settingsStore.set({ locale: this.selectedLocale });
        const bundle = this.getBundle();
        this.broadcast(bundle);
        return bundle;
    }

    t(key: string, variables: FormatArgs = {}): string {
        const value = this.getBundle().messages[key] ?? key;
        return formatMessage(value, variables);
    }

    broadcast(bundle = this.getBundle()): void {
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send(Bridge.Localization.onChanged, bundle);
        }
    }

    private resolveInitialLocale(savedLocale: string | undefined): string {
        const normalizedSavedLocale = !savedLocale ? undefined : this.normalizeLocale(savedLocale);

        if (!!normalizedSavedLocale && this.hasLocale(normalizedSavedLocale)) {
            return normalizedSavedLocale;
        }

        const systemLocale = this.normalizeLocale(app.getLocale());

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
        const normalized = this.normalizeLocale(locale);

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
        return [...this.builtInLocales.values()]
            .map((locale) => ({
                locale: locale.locale,
                name: locale.name,
                nativeName: locale.nativeName,
                iconPng: locale.iconPng,
                source: locale.source
            }))
            .sort((a, b) => a.nativeName.localeCompare(b.nativeName));
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
        return this.builtInLocales.has(locale);
    }

    private normalizeLocale(locale: string): string {
        return locale.trim().replace("_", "-").toLowerCase();
    }
}
