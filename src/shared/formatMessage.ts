import { FormatArgs } from "./FormatArgs";

const formatRegex = /\{([a-zA-Z0-9_.-]+)}/g;

const htmlEscapeMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
};

export function formatMessage(message: string, variables: FormatArgs = {}): string {
    return formatWithValueMapper(message, variables, String);
}

export function formatHtmlMessage(message: string, variables: FormatArgs = {}): string {
    return formatWithValueMapper(message, variables, (value) => escapeHtml(String(value)));
}

function formatWithValueMapper(message: string, variables: FormatArgs, mapValue: (value: unknown) => string): string {
    return message.replace(formatRegex, (match, key: string) => {
        const value = variables[key];
        return value === undefined ? match : mapValue(value);
    });
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => htmlEscapeMap[char]);
}
