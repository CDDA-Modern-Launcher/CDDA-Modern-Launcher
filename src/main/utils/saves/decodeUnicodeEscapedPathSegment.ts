export function decodeUnicodeEscapedPathSegment(value: string): string | null {
    if (!/^#U[0-9a-fA-F]{4}/.test(value)) return null;
    const decoded = value.replace(/#U([0-9a-fA-F]{4})/g, (_match, code: string) => String.fromCharCode(parseInt(code, 16))).trim();
    return decoded.length > 0 ? decoded : null;
}
