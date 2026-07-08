const allowedHtmlTagMap = new Map<string, string>([
    ["strong", "strong"],
    ["b", "b"],
    ["em", "em"],
    ["i", "i"],
    ["u", "u"],
    ["underline", "u"],
    ["ins", "ins"],
    ["s", "s"],
    ["strike", "s"],
    ["strikethrough", "s"],
    ["del", "del"],
    ["code", "code"],
    ["kbd", "kbd"],
    ["small", "small"],
    ["sub", "sub"],
    ["sup", "sup"],
    ["mark", "mark"],
    ["br", "br"]
]);

const voidHtmlTags = new Set(["br"]);
const htmlTagRegex = /<\/?([a-zA-Z][a-zA-Z0-9-]*)(?:\s[^>]*)?\/?\s*>/g;

export function sanitizeLocalizedHtml(html: string): string {
    return html.replace(htmlTagRegex, (match, tagName: string) => {
        const normalizedTagName = tagName.toLowerCase();
        const outputTagName = allowedHtmlTagMap.get(normalizedTagName);

        if (outputTagName === undefined) {
            return "";
        }

        if (voidHtmlTags.has(outputTagName)) {
            return `<${outputTagName}>`;
        }

        return match.startsWith("</") ? `</${outputTagName}>` : `<${outputTagName}>`;
    });
}
