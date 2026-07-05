import { LocaleMessages } from "./LocaleMessages";

export type LocaleFile = {
    schemaVersion: 1;
    locale: string;
    name: string;
    nativeName: string;
    iconPng: string;
    messages: LocaleMessages;
};
