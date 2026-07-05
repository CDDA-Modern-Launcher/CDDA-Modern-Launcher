import React, { useCallback, useEffect, useMemo, useState } from "react";

import { INITIAL_BUNDLE, LocalizationContext, LocalizationContextValue, MessageVariables } from "./LocalizationContext";
import { LocalizationBundle } from "../../../shared/localization/types/LocalizationBundle";
import { formatMessage } from "../../../shared/formatMessage";

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
            return formatMessage(bundle.messages[key] ?? key, variables);
        },
        [bundle.messages]
    );

    const setLocale = useCallback(async (locale: string): Promise<void> => {
        setBundle(await window.api.localization.setLocale(locale));
    }, []);

    const value = useMemo<LocalizationContextValue>(() => ({ ...bundle, t, setLocale }), [bundle, setLocale, t]);

    return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}
