export function decodeBase64Utf8(value: string): string | null {
    try {
        const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
        const decoded = Buffer.from(padded, "base64").toString("utf8").replace(/\0/g, "").trim();
        return decoded.length > 0 ? decoded : null;
    } catch {
        return null;
    }
}
