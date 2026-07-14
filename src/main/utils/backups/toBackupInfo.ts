import { BackupInstanceInfo } from "../../../shared/backups/types/BackupInstanceInfo";
import { BackupInfo } from "../../../shared/backups/types/BackupInfo";

export function toBackupInfo(backup: BackupInstanceInfo): BackupInfo {
    return {
        schemaVersion: backup.schemaVersion,
        id: backup.id,
        worldName: backup.worldName,
        worldFolderName: backup.worldFolderName,
        characterName: backup.characterName,
        platformId: backup.platformId,
        gameVersion: backup.gameVersion,
        createdAt: backup.createdAt,
        type: backup.type,
        comment: backup.comment
    };
}
