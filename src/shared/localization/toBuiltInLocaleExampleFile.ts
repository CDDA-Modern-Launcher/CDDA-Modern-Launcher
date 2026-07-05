import { LoadedLocale } from "./types/LoadedLocale";
import { LocaleFile } from "./types/LocaleFile";
import { BUILT_IN_LOCALE_EXAMPLE_COMMENT } from "../Const";

export function toBuiltInLocaleExampleFile(locale: LoadedLocale): LocaleFile & { __comment: string } {
    return {
        __comment: BUILT_IN_LOCALE_EXAMPLE_COMMENT,
        schemaVersion: 1,
        locale: locale.locale,
        name: locale.name,
        nativeName: locale.nativeName,
        iconPng: locale.iconPng,
        messages: locale.messages
    };
}
