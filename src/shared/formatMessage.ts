import { FormatArgs } from "./FormatArgs";

const formatRegex = /\{([a-zA-Z0-9_.-]+)}/g;

export function formatMessage(message: string, variables: FormatArgs = {}): string {
    return message.replace(formatRegex, (match, key: string) => {
        const value = variables[key];
        return value === undefined ? match : String(value);
    });
}
