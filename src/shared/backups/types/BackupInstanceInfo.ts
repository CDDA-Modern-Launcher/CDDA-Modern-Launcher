import { BackupInfo } from "./BackupInfo";

export type BackupInstanceInfo = BackupInfo & {
    path: string;
    archivePath: string;
};
