import { TBackupKind } from "./TBackupKind";

export type BackupInfo = {
    schemaVersion: 1;
    id: string;
    worldName: string;
    worldFolderName: string;
    characterName: string;
    platformId: string;
    gameVersion: string;
    createdAt: string;
    type: TBackupKind;
    comment: string;
};
