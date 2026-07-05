import { TAutoBackupCooldown } from "./types/TAutoBackupCooldown";

export function toAutoBackupCooldownMs(value: TAutoBackupCooldown): number {
    switch (value) {
        case "disabled":
            return 0;
        case "5s":
            return 5_000;
        case "15s":
            return 15_000;
        case "1m":
            return 60_000;
    }
}
