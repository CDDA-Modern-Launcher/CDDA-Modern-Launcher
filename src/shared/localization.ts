export const DEFAULT_LOCALE = "en";
export const REPOSITORY_LOCALES_DIRECTORY = "locales";

export type LocaleSource = "built-in" | "repository";

export type LocaleMessages = Record<string, string>;

export type LocaleFile = {
    schemaVersion: 1;
    locale: string;
    name: string;
    nativeName: string;
    iconPng: string;
    messages: LocaleMessages;
};

export type LocaleOption = {
    locale: string;
    name: string;
    nativeName: string;
    iconPng: string;
    source: LocaleSource;
};

export type LocalizationBundle = {
    selectedLocale: string;
    effectiveLocale: string;
    fallbackLocale: typeof DEFAULT_LOCALE;
    options: LocaleOption[];
    messages: LocaleMessages;
};
