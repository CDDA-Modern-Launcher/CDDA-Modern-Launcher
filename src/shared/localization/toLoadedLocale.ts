import { LocaleFile } from "./types/LocaleFile";
import { LocaleSource } from "./types/LocaleSource";
import { LoadedLocale } from "./types/LoadedLocale";

export function toLoadedLocale(file: LocaleFile, locale: string, source: LocaleSource): LoadedLocale {
    return {
        schemaVersion: 1,
        locale,
        name: file.name,
        nativeName: file.nativeName,
        iconPng: file.iconPng,
        messages: file.messages,
        source
    };
}
