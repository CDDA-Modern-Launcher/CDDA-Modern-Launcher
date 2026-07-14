import { LocaleMessages } from "./LocaleMessages";
import { EN_LOCALE } from "../locales/en";

export type LocaleFile = {
    locale: string;
    nativeName: string;
    iconPng: string;
    messages: LocaleMessages;
};

export type LocaleKeys = keyof typeof EN_LOCALE.messages;

export type LocaleFileImpl = LocaleFile & { messages: { [K in LocaleKeys]: string } };
