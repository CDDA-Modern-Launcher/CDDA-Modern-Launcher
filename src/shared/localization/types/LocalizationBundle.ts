import { DEFAULT_LOCALE } from "../../Const";
import { LocaleOption } from "./LocaleOption";
import { LocaleMessages } from "./LocaleMessages";

export type LocalizationBundle = {
    selectedLocale: string;
    effectiveLocale: string;
    fallbackLocale: typeof DEFAULT_LOCALE;
    options: LocaleOption[];
    messages: LocaleMessages;
};
