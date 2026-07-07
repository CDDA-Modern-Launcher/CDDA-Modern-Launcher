import { EN_LOCALE } from "./locales/en";
import { RU_LOCALE } from "./locales/ru";
import { LoadedLocale } from "./types/LoadedLocale";

export const BUILT_IN_LOCALES: LoadedLocale[] = [
    {
        ...EN_LOCALE,
        source: "built-in"
    },
    {
        ...RU_LOCALE,
        source: "built-in"
    }
];
