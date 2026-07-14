import { GameBundle } from "../../../shared/game-bundle/GameBundle";
import { BackupInstanceInfo } from "../../../shared/backups/types/BackupInstanceInfo";
import { scanBackups } from "./scanBackups";

export async function findBackup(gameBundle: GameBundle, backupId: string): Promise<BackupInstanceInfo | null> {
    return (await scanBackups(gameBundle)).backups.find((backup) => backup.id === backupId) ?? null;
}
