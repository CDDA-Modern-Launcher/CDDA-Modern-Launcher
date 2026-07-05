import { TAutoBackupCooldown } from "./types/TAutoBackupCooldown";

export function isAutoBackupCooldown(value: unknown): value is TAutoBackupCooldown {
    return value === "disabled" || value === "5s" || value === "15s" || value === "1m";
}
