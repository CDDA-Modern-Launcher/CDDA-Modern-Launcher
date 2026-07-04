import React, { useCallback, useEffect, useMemo, useState } from "react";

import { LocalizationBundle } from "../../../shared/localization";
import { INITIAL_BUNDLE, LocalizationContext, LocalizationContextValue, MessageVariables } from "./LocalizationContext";

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
            return template.replace(/\{([a-zA-Z0-9_.-]+)}/g, (match, variableName: string) => {
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
