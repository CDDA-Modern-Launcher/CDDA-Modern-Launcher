export function parseJsonc(content: string): unknown {
    return JSON.parse(stripJsonComments(content));
}

function stripJsonComments(content: string): string {
    let result = "";
    let inString = false;
    let escaped = false;

    for (let index = 0; index < content.length; index += 1) {
        const char = content[index];
        const next = content[index + 1];

        if (inString) {
            result += char;

            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }

            continue;
        }

        if (char === '"') {
            inString = true;
            result += char;
            continue;
        }

        if (char === "/" && next === "/") {
            index += 2;

            while (index < content.length && content[index] !== "\n" && content[index] !== "\r") {
                index += 1;
            }

            if (index < content.length) {
                result += content[index];
            }

            continue;
        }

        if (char === "/" && next === "*") {
            index += 2;

            while (index < content.length && !(content[index] === "*" && content[index + 1] === "/")) {
                index += 1;
            }

            index += 1;
            continue;
        }

        result += char;
    }

    return result;
}
