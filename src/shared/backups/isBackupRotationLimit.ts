import { TBackupRotationLimit } from "./types/TBackupRotationLimit";

export function isBackupRotationLimit(value: unknown): value is TBackupRotationLimit {
    return value === "disabled" || value === "3" || value === "5" || value === "10";
}
