import { TAutoBackupLimit } from "./types/TAutoBackupLimit";

export function isAutoBackupLimit(value: unknown): value is TAutoBackupLimit {
    return value === "disabled" || value === "3" || value === "5" || value === "10";
}
