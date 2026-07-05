import { LocaleMessages } from "./types/LocaleMessages";

export function mergeMessages(...sources: Array<LocaleMessages | undefined>): LocaleMessages {
    return Object.assign({}, ...sources.filter((source): source is LocaleMessages => source !== undefined));
}
