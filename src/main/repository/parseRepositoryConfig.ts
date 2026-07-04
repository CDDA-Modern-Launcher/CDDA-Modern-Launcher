import { parse, type ParseError, printParseErrorCode } from "jsonc-parser";

export function parseRepositoryConfig(content: string, sourceName: string): unknown {
    const errors: ParseError[] = [];
    const value = parse(content, errors, {
        allowTrailingComma: true,
        disallowComments: false
    });

    if (errors.length > 0) {
        const error = errors[0];
        const position = getLineColumn(content, error.offset);
        const reason = printParseErrorCode(error.error);

        throw new Error(`Invalid JSONC in ${sourceName}: ${reason} at ${position.line}:${position.column}`);
    }

    return value;
}

function getLineColumn(content: string, offset: number): { line: number; column: number } {
    const prefix = content.slice(0, offset);
    const lines = prefix.split(/\r\n|\r|\n/);

    return {
        line: lines.length,
        column: lines[lines.length - 1].length + 1
    };
}
