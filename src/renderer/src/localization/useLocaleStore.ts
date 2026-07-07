import { create } from "zustand";
import { IMountableState } from "@renderer/types/IMountableState";
import { LocalizationBundle } from "../../../shared/localization/types/LocalizationBundle";
import { TMountFn } from "@renderer/types/TMountFn";
import { FormatArgs } from "../../../shared/FormatArgs";
import { formatMessage } from "../../../shared/formatMessage";

export type TLocalizeFn = (key: string, variables?: FormatArgs) => string;
type TSetLocaleFn = (locale: string) => Promise<void>;

interface State extends IMountableState {
    bundle: LocalizationBundle;
    localize: TLocalizeFn;
    setLocale: TSetLocaleFn;
}

const DEFAULT_LOCALE = "en";

const INITIAL_BUNDLE: LocalizationBundle = {
    selectedLocale: DEFAULT_LOCALE,
    effectiveLocale: DEFAULT_LOCALE,
    fallbackLocale: DEFAULT_LOCALE,
    options: [],
    messages: {}
};

const useLocaleStore = create<State>()((set) => ({
    bundle: INITIAL_BUNDLE,

    localize: (key, variables = {}) => {
        const bundle: LocalizationBundle = useLocaleStore.getState().bundle;
        const message: string = bundle.messages[key] ?? key;
        return formatMessage(message, variables);
    },

    setLocale: async (locale) => {
        const bundle = await window.api.localization.setLocale(locale);
        set({ bundle });
    },

    mount: () => {
        void window.api.localization.getBundle().then((bundle) => set({ bundle }));
        const unsubscribe = window.api.localization.onChanged((bundle) => set({ bundle }));
        return function cleanup() {
            unsubscribe();
        };
    }
}));

export function useLocaleStoreMount(): TMountFn {
    return useLocaleStore((state) => state.mount);
}

export function useSetLocale(): TSetLocaleFn {
    return useLocaleStore((state) => state.setLocale);
}

export function useLocaleInfo(): Pick<LocalizationBundle, "selectedLocale" | "effectiveLocale" | "options"> {
    const bundle = useLocaleStore((state) => state.bundle);
    return {
        selectedLocale: bundle.selectedLocale,
        effectiveLocale: bundle.effectiveLocale,
        options: bundle.options
    };
}

export function useTranslate(): TLocalizeFn {
    return useLocaleStore((state) => state.localize);
}
