export function coalesceText(...values: Array<string | null | undefined>): string {
    for (const value of values) {
        if (value !== null && value !== undefined && value.trim().length > 0) {
            return value;
        }
    }

    return "";
}
