import { decodeUnicodeEscapedPathSegment } from "./decodeUnicodeEscapedPathSegment";

export function decodeWorldFolderName(folderName: string): string {
    const unicodeDecoded = decodeUnicodeEscapedPathSegment(folderName);
    return unicodeDecoded ?? folderName;
}
