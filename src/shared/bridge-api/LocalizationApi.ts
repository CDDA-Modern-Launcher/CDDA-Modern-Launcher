import { LocalizationBundle } from "../localization/types/LocalizationBundle";

export type LocalizationApi = {
    getBundle: () => Promise<LocalizationBundle>;
    setLocale: (locale: string) => Promise<LocalizationBundle>;
    onChanged: (callback: (bundle: LocalizationBundle) => void) => () => void;
};
