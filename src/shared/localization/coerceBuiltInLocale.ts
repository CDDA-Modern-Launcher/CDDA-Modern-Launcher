import { LocaleFile } from "./types/LocaleFile";

import { isLocaleFile } from "./isLocaleFile";

export function coerceBuiltInLocale(value: unknown, expectedLocale: string): LocaleFile {
    if (!isLocaleFile(value)) throw new Error(`Invalid built-in locale file: ${expectedLocale}`);
    return value;
}
