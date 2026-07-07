export function safePathSegment(value: string): string {
    return (
        value
            .split("")
            .map((char) => (/[<>:"/\\|?*]/.test(char) || char.charCodeAt(0) < 32 ? "_" : char))
            .join("")
            .trim() || "release"
    );
}
