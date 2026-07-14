import { LocaleOption } from "./LocaleOption";
import { LocaleMessages } from "./LocaleMessages";

export type LocalizationBundle = {
    locale: string;
    options: LocaleOption[];
    messages: LocaleMessages;
};
