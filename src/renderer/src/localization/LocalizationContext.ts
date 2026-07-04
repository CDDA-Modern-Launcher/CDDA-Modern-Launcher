import { createContext, useContext } from "react";

import { DEFAULT_LOCALE, LocalizationBundle } from "../../../shared/localization";

export type MessageVariables = Record<string, string | number>;

export type LocalizationContextValue = LocalizationBundle & {
    t: (key: string, variables?: MessageVariables) => string;
    setLocale: (locale: string) => Promise<void>;
};

export const INITIAL_BUNDLE: LocalizationBundle = {
    selectedLocale: DEFAULT_LOCALE,
    effectiveLocale: DEFAULT_LOCALE,
    fallbackLocale: DEFAULT_LOCALE,
    options: [],
    messages: {}
};

export const LocalizationContext = createContext<LocalizationContextValue | null>(null);

export function useLocalization(): LocalizationContextValue {
    const value = useContext(LocalizationContext);

    if (value === null) {
        throw new Error("useLocalization must be used inside LocalizationProvider");
    }

    return value;
}
