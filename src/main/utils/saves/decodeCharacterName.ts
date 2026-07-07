import { decodeCddaSaveFileName } from "./decodeCddaSaveFileName";

export function decodeCharacterName(fileName: string): string {
    const encoded = fileName.replace(/^#/, "").replace(/\.sav\.zzip$/i, "");
    const decoded = decodeCddaSaveFileName(encoded);
    return decoded ?? encoded;
}
