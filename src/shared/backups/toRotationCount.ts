import { TAutoBackupLimit } from "./types/TAutoBackupLimit";
import { TBackupRotationLimit } from "./types/TBackupRotationLimit";

export function toRotationCount(value: TAutoBackupLimit | TBackupRotationLimit): number | null {
    return value === "disabled" ? null : Number(value);
}
