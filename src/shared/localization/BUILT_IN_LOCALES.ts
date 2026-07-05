import { LocaleFile } from "./types/LocaleFile";
import builtInEn from "./locales/en.json";
import builtInRu from "./locales/ru.json";
import { coerceBuiltInLocale } from "./coerceBuiltInLocale";

export const BUILT_IN_LOCALES: LocaleFile[] = [coerceBuiltInLocale(builtInEn, "en"), coerceBuiltInLocale(builtInRu, "ru")];
