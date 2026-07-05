import { TBackupKind } from "./TBackupKind";

export type BackupProgress =
    | { status: "idle" }
    | { status: "creating"; percent: number | null; worldName: string; characterName: string; type: TBackupKind }
    | { status: "restoring"; backupId: string; percent: number | null }
    | { status: "completed"; message?: string }
    | { status: "error"; message: string };
