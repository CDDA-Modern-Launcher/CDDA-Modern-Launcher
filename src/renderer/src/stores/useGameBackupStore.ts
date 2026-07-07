import { create } from "zustand";
import { IMountableState } from "@renderer/types/IMountableState";
import { BackupProgress } from "../../../shared/backups/types/BackupProgress";
import { BackupSummary } from "../../../shared/backups/types/BackupSummary";
import { CreateManualBackupOptions } from "../../../shared/backups/types/CreateManualBackupOptions";

interface GameBackupStoreState extends IMountableState {
    summary: BackupSummary;
    progress: BackupProgress;
    createManual: (options?: CreateManualBackupOptions) => Promise<boolean>;
    restore: (backupId: string) => Promise<boolean>;
    delete: (backupId: string) => Promise<boolean>;
    rename: (backupId: string, comment: string) => Promise<boolean>;
}

const EMPTY_BACKUP_SUMMARY: BackupSummary = { backups: [], latestBackup: null };

export const useGameBackupStore = create<GameBackupStoreState>()((set) => ({
    summary: EMPTY_BACKUP_SUMMARY,
    progress: { status: "idle" },

    mount: () => {
        const unsubscribeProgress = window.api.game.onBackupProgress((progress) => set({ progress }));
        const unsubscribeSummary = window.api.game.onBackupSummaryChanged((update) => set({ summary: update.summary }));
        const unsubscribeState = window.api.game.onStateChanged((state) => set({ summary: state.status === "ready" ? state.backups : EMPTY_BACKUP_SUMMARY }));

        return function cleanup() {
            unsubscribeState();
            unsubscribeSummary();
            unsubscribeProgress();
        };
    },

    createManual: async (options = {}) => {
        const result = await window.api.game.createManualBackup(options);
        if (result.status === "created") return true;
        if (result.status === "error" || result.status === "unavailable" || result.status === "blocked") console.error("Failed to create backup", result.message);
        return false;
    },

    restore: async (backupId) => {
        const result = await window.api.game.restoreBackup(backupId);
        if (result.status === "restored") return true;
        console.error("Failed to restore backup", result.message);
        return false;
    },

    delete: async (backupId) => {
        const result = await window.api.game.deleteBackup(backupId);
        if (result.status === "deleted") return true;
        console.error("Failed to delete backup", result.message);
        return false;
    },

    rename: async (backupId, comment) => {
        const result = await window.api.game.renameBackup(backupId, comment);
        if (result.status === "renamed") return true;
        console.error("Failed to rename backup", result.message);
        return false;
    }
}));
