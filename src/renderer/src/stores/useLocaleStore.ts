import { useCallback } from "react";
import { create } from "zustand";
import { IMountableState } from "@renderer/types/IMountableState";
import { LocalizationBundle } from "../../../shared/localization/types/LocalizationBundle";
import { TMountFn } from "@renderer/types/TMountFn";
import { FormatArgs } from "../../../shared/FormatArgs";
import { formatHtmlMessage, formatMessage } from "../../../shared/formatMessage";
import { LocaleKeys } from "../../../shared/localization/types/LocaleFile";
import { sanitizeLocalizedHtml } from "@renderer/utils/sanitizeLocalizedHtml";

export type TLocalizeFn = (key: LocaleKeys, variables?: FormatArgs) => string;
export type TLocalizeHtmlFn = (key: LocaleKeys, variables?: FormatArgs) => string;
type TSetLocaleFn = (locale: string) => Promise<void>;

interface State extends IMountableState {
    bundle: LocalizationBundle;
    localize: TLocalizeFn;
    setLocale: TSetLocaleFn;
}

const INITIAL_BUNDLE: LocalizationBundle = {
    locale: "en",
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

export function useLocaleInfo(): Pick<LocalizationBundle, "locale" | "options"> {
    const bundle = useLocaleStore((state) => state.bundle);
    return {
        locale: bundle.locale,
        options: bundle.options
    };
}

export function useTranslate(): TLocalizeFn {
    const messages = useLocaleStore((state) => state.bundle.messages);

    return useCallback(
        (key, variables = {}) => {
            const message: string = messages[key] ?? key;
            return formatMessage(message, variables);
        },
        [messages]
    );
}

export function useTranslateHtml(): TLocalizeHtmlFn {
    const bundle = useLocaleStore((state) => state.bundle);

    return (key, variables = {}) => {
        const message: string = bundle.messages[key] ?? key;
        return sanitizeLocalizedHtml(formatHtmlMessage(message, variables));
    };
}

export function translate(key: LocaleKeys, variables?: FormatArgs): string {
    return useLocaleStore.getState().localize(key, variables);
}

export function translateHtml(key: LocaleKeys, variables?: FormatArgs): string {
    const bundle = useLocaleStore.getState().bundle;
    const message: string = bundle.messages[key] ?? key;
    return sanitizeLocalizedHtml(formatHtmlMessage(message, variables));
}
