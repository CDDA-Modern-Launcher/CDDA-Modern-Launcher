import { app, type BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import util from "node:util";

const MAX_LOG_FILES = 30;
const LOG_FILE_PATTERN = /^main-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}\.log(?:\.bak)?$/;

let logStream: fs.WriteStream | undefined;

export function initializeConsoleLogging(): void {
    const logsDirectory = path.join(app.getPath("userData"), "logs");

    fs.mkdirSync(logsDirectory, { recursive: true });

    rotateLogs(logsDirectory);

    const logFilePath = path.join(logsDirectory, `main-${formatFileTimestamp(new Date())}.log`);
    logStream = fs.createWriteStream(logFilePath, { flags: "a", encoding: "utf8" });

    redirectConsoleMethod("log", "INFO");
    redirectConsoleMethod("info", "INFO");
    redirectConsoleMethod("warn", "WARN");
    redirectConsoleMethod("error", "ERROR");
    redirectConsoleMethod("debug", "DEBUG");
}

function rotateLogs(logsDirectory: string): void {
    const oldLogs = fs
        .readdirSync(logsDirectory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && LOG_FILE_PATTERN.test(entry.name))
        .map((entry) => {
            const filePath = path.join(logsDirectory, entry.name);
            return { filePath, modifiedAt: fs.statSync(filePath).mtimeMs };
        })
        .sort((left, right) => right.modifiedAt - left.modifiedAt);

    for (const oldLog of oldLogs.slice(MAX_LOG_FILES - 1)) {
        fs.rmSync(oldLog.filePath, { force: true });
    }
}

function formatFileTimestamp(date: Date): string {
    const year = date.getFullYear();
    const month = padNumber(date.getMonth() + 1, 2);
    const day = padNumber(date.getDate(), 2);
    const hours = padNumber(date.getHours(), 2);
    const minutes = padNumber(date.getMinutes(), 2);
    const seconds = padNumber(date.getSeconds(), 2);
    const milliseconds = padNumber(date.getMilliseconds(), 3);
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}-${milliseconds}`;
}

function padNumber(value: number, length: number): string {
    return value.toString().padStart(length, "0");
}

function redirectConsoleMethod(method: keyof Pick<typeof console, "log" | "info" | "warn" | "error" | "debug">, level: string): void {
    const originalMethod = console[method].bind(console);

    console[method] = (...args: unknown[]): void => {
        originalMethod(...args);

        const message = args
            .map((argument) =>
                typeof argument === "string"
                    ? argument
                    : util.inspect(argument, {
                          depth: 6,
                          colors: false,
                          breakLength: Infinity
                      })
            )
            .join(" ");

        logStream?.write(`${new Date().toISOString()} [${level}] ${message}\n`);
    };
}

export function attachRendererLogging(window: BrowserWindow): void {
    window.webContents.on("console-message", ({ level, message, lineNumber, sourceId }) => {
        const location = sourceId && lineNumber > 0 ? ` (${sourceId}:${lineNumber})` : "";

        switch (level) {
            case "error":
                console.error(`[RENDERER:ERROR] ${message}${location}`);
                break;
            case "warning":
                console.warn(`[RENDERER:WARN ] ${message}${location}`);
                break;
            case "debug":
                console.debug(`[RENDERER:DEBUG] ${message}${location}`);
                break;
            case "info":
            default:
                console.info(`[RENDERER:INFO ] ${message}${location}`);
                break;
        }
    });
}
