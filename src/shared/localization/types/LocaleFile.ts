import { LocaleMessages } from "./LocaleMessages";
import { EN_LOCALE } from "../locales/en";

export type LocaleFile = {
    schemaVersion: 1;
    locale: string;
    name: string;
    nativeName: string;
    iconPng: string;
    messages: LocaleMessages;
};

export type LocaleKeys = keyof typeof EN_LOCALE.messages;

export type LocaleFileImpl = LocaleFile & { messages: { [K in LocaleKeys]: string } };
