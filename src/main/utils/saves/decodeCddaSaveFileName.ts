import { decodeBase64Utf8 } from "./decodeBase64Utf8";

export function decodeCddaSaveFileName(encoded: string): string | null {
    const candidates = [encoded.replace(/-/g, "/").replace(/_/g, "/"), encoded.replace(/-/g, "+").replace(/_/g, "/"), encoded];

    for (const candidate of candidates) {
        const decoded = decodeBase64Utf8(candidate);
        if (decoded !== null && !decoded.includes("�")) return decoded;
    }

    return null;
}
