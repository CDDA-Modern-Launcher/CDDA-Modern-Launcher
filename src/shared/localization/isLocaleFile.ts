import { LocaleFile } from "./types/LocaleFile";

export function isLocaleFile(value: unknown): value is LocaleFile {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidate = value as Partial<LocaleFile>;
    // noinspection SuspiciousTypeOfGuard
    return (
        candidate.schemaVersion === 1 &&
        typeof candidate.locale === "string" &&
        candidate.locale.trim().length > 0 &&
        typeof candidate.name === "string" &&
        typeof candidate.nativeName === "string" &&
        typeof candidate.iconPng === "string" &&
        candidate.iconPng.startsWith("data:image/png;base64,") &&
        typeof candidate.messages === "object" &&
        candidate.messages !== null &&
        Object.values(candidate.messages).every((message) => typeof message === "string")
    );
}
