import { LocaleFile } from "./LocaleFile";
import { LocaleSource } from "./LocaleSource";

export type LoadedLocale = LocaleFile & {
    source: LocaleSource;
};
