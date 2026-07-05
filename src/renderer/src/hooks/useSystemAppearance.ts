import { useCallback, useEffect, useState } from "react";

import { AppTheme } from "../../../shared/appearance/AppTheme";
import { AppAppearance } from "../../../shared/appearance/AppAppearance";

export type SystemAppearanceState = AppAppearance & {
    setTheme: (theme: AppTheme) => Promise<void>;
};

export function useSystemAppearance(): SystemAppearanceState {
    const [appearance, setAppearance] = useState<AppAppearance>(() => window.api.appearance.getInitial());

    useEffect(() => {
        let mounted = true;

        window.api.appearance.get().then((initialAppearance) => {
            if (mounted) {
                setAppearance(initialAppearance);
            }
        });

        const unsubscribe = window.api.appearance.onChanged(setAppearance);

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    const setTheme = useCallback(async (theme: AppTheme): Promise<void> => {
        setAppearance(await window.api.appearance.setTheme(theme));
    }, []);

    return { ...appearance, setTheme };
}
