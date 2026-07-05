import { BUILT_IN_LOCALE_EXAMPLE_COMMENT } from "../Const";

export function isBuiltInLocaleExampleFile(value: unknown): boolean {
    return typeof value === "object" && value !== null && "__comment" in value && (value as { __comment?: unknown }).__comment === BUILT_IN_LOCALE_EXAMPLE_COMMENT;
}
