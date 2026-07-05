import { FormatArgs } from "./FormatArgs";

export function formatMessage(message: string, variables: FormatArgs = {}): string {
    return message.replace(/\{([a-zA-Z0-9_.-]+)}/g, (match, key: string) => {
        const value = variables[key];
        return value === undefined ? match : String(value);
    });
}
