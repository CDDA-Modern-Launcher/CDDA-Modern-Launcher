export function toAssetNameParts(value: string | string[]): string[] {
    return Array.isArray(value) ? value : [value];
}
