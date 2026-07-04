import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { DEFAULT_LOCALE, LocalizationBundle } from "../../../shared/localization";

type MessageVariables = Record<string, string | number>;

type LocalizationContextValue = LocalizationBundle & {
    t: (key: string, variables?: MessageVariables) => string;
    setLocale: (locale: string) => Promise<void>;
};

const INITIAL_BUNDLE: LocalizationBundle = {
    selectedLocale: DEFAULT_LOCALE,
    effectiveLocale: DEFAULT_LOCALE,
    fallbackLocale: DEFAULT_LOCALE,
    options: [],
    messages: {}
};

const LocalizationContext = createContext<LocalizationContextValue | null>(null);

export function LocalizationProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
    const [bundle, setBundle] = useState<LocalizationBundle>(INITIAL_BUNDLE);

    useEffect(() => {
        let mounted = true;

        window.api.localization.getBundle().then((initialBundle) => {
            if (mounted) {
                setBundle(initialBundle);
            }
        });

        const unsubscribe = window.api.localization.onChanged(setBundle);

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    const t = useCallback(
        (key: string, variables: MessageVariables = {}) => {
            const template = bundle.messages[key] ?? key;
            return template.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, variableName: string) => {
                const value = variables[variableName];
                return value === undefined ? match : String(value);
            });
        },
        [bundle.messages]
    );

    const setLocale = useCallback(async (locale: string): Promise<void> => {
        setBundle(await window.api.localization.setLocale(locale));
    }, []);

    const value = useMemo<LocalizationContextValue>(() => ({ ...bundle, t, setLocale }), [bundle, setLocale, t]);

    return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useLocalization(): LocalizationContextValue {
    const value = useContext(LocalizationContext);

    if (value === null) {
        throw new Error("useLocalization must be used inside LocalizationProvider");
    }

    return value;
}
