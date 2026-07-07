import { create } from "zustand";
import { GameBundleState } from "../../../shared/game-bundle/GameBundleState";
import { GameBundleInstallProgress } from "../../../shared/game-bundle/GameBundleInstallProgress";
import { BackupProgress } from "../../../shared/backups/types/BackupProgress";
import { BackupSummary } from "../../../shared/backups/types/BackupSummary";
import { GithubRelease } from "../../../shared/GithubRelease";
import { GameBundleInstallOptions } from "../../../shared/game-bundle/GameBundleInstallOptions";
import { GameFileOperationState } from "../../../shared/game-bundle/GameFileOperationState";
import { GameBundleDeleteOptions } from "../../../shared/game-bundle/GameBundleDeleteOptions";
import { GameLaunchOptions } from "../../../shared/launch/GameLaunchOptions";
import { CreateManualBackupOptions } from "../../../shared/backups/types/CreateManualBackupOptions";
import { GameRuntimeState } from "../../../shared/GameRuntimeState";
import { getErrorMessage } from "../../../shared/getErrorMessage";
import { IMountableState } from "@renderer/types/IMountableState";
import { isGameBundleInstallRunning } from "@renderer/utils/isGameBundleInstallRunning";
import { applyGameState, createGameBundleSubscriptions, EMPTY_BACKUP_SUMMARY, isFileOperationBlocked, setResultError, toErrorState } from "./gameBundleStoreUtils";

export interface GameBundleStoreState extends IMountableState {
    state: GameBundleState;
    installProgress: GameBundleInstallProgress;
    backupProgress: BackupProgress;
    backupSummary: BackupSummary;
    isCheckingLatest: boolean;
    fileOperation: GameFileOperationState;
    isInstallingGameBundle: boolean;
    releases: GithubRelease[];
    isLoadingReleases: boolean;
    isLoadingReleaseNotes: boolean;
    isFileOperationRunning: boolean;

    load: () => Promise<void>;
    refresh: (refreshLatest?: boolean, forceRefresh?: boolean) => Promise<void>;
    loadReleases: (forceRefresh?: boolean) => Promise<GithubRelease[]>;
    installLatestGameBundle: (options: GameBundleInstallOptions) => Promise<boolean>;
    setActiveGameBundle: (gameBundleId: string) => Promise<boolean>;
    deleteGameBundle: (gameBundleId: string, options: GameBundleDeleteOptions) => Promise<boolean>;
    launchActiveGameBundle: (options?: GameLaunchOptions) => Promise<boolean>;
    stopGame: () => Promise<boolean>;
    createManualBackup: (options?: CreateManualBackupOptions) => Promise<boolean>;
    restoreBackup: (backupId: string) => Promise<boolean>;
    deleteBackup: (backupId: string) => Promise<boolean>;
    renameBackup: (backupId: string, comment: string) => Promise<boolean>;
    setRuntimeState: (runtimeState: GameRuntimeState) => void;
    setReleaseNotesLoading: (isLoadingReleaseNotes: boolean) => void;
    setError: (message: string) => void;
}

export const useGameBundleStore = create<GameBundleStoreState>()((set, get) => ({
    state: { status: "loading" },
    installProgress: { status: "idle" },
    backupProgress: { status: "idle" },
    backupSummary: EMPTY_BACKUP_SUMMARY,
    isCheckingLatest: false,
    fileOperation: { status: "idle" },
    isInstallingGameBundle: false,
    releases: [],
    isLoadingReleases: false,
    isLoadingReleaseNotes: false,
    isFileOperationRunning: false,

    mount: () => createGameBundleSubscriptions(set, get),

    load: async () => {
        set({ state: { status: "loading" }, releases: [], isCheckingLatest: false });
        try {
            const localState = await window.api.game.getState({ refreshLatest: false });
            applyGameState(set, localState);
            if (localState.status !== "ready") return;

            set({ isCheckingLatest: true });
            try {
                applyGameState(set, await window.api.game.getState({ refreshLatest: true, forceRefresh: false }));
            } catch (error) {
                set((current) => ({
                    state: current.state.status === "ready" ? { ...current.state, latestRelease: null, latestReleaseError: getErrorMessage(error), updateAvailable: false } : toErrorState(error)
                }));
            } finally {
                set({ isCheckingLatest: false });
            }
        } catch (error) {
            set({ state: toErrorState(error), backupSummary: EMPTY_BACKUP_SUMMARY });
        }
    },

    refresh: async (refreshLatest = true, forceRefresh = false) => {
        if (refreshLatest) set({ isCheckingLatest: true });
        try {
            applyGameState(set, await window.api.game.getState({ refreshLatest, forceRefresh }));
        } catch (error) {
            set({ state: toErrorState(error) });
        } finally {
            if (refreshLatest) set({ isCheckingLatest: false });
        }
    },

    loadReleases: async (forceRefresh = false) => {
        set({ isLoadingReleases: true });
        try {
            const releases = await window.api.game.getReleases(forceRefresh);
            set({ releases });
            return releases;
        } catch (error) {
            console.error("Failed to load releases", error);
            set({ releases: [] });
            return [];
        } finally {
            set({ isLoadingReleases: false });
        }
    },

    installLatestGameBundle: async (options) => {
        if (isFileOperationBlocked(get)) return false;
        set({ isInstallingGameBundle: true });
        try {
            const result = await window.api.game.installLatestGameBundle(options);
            if (result.status === "installed") {
                applyGameState(set, result.state);
                return true;
            }
            setResultError(set, result.message);
            return false;
        } finally {
            set({ isInstallingGameBundle: false });
        }
    },

    setActiveGameBundle: async (gameBundleId) => {
        if (isFileOperationBlocked(get)) return false;
        const result = await window.api.game.setActiveGameBundle(gameBundleId);
        if (result.status === "updated") {
            applyGameState(set, result.state);
            return true;
        }
        setResultError(set, result.message);
        return false;
    },

    deleteGameBundle: async (gameBundleId, options) => {
        if (isFileOperationBlocked(get)) return false;
        const result = await window.api.game.deleteGameBundle(gameBundleId, options);
        if (result.status === "deleted") {
            applyGameState(set, result.state);
            return true;
        }
        setResultError(set, result.message);
        return false;
    },

    launchActiveGameBundle: async (options = {}) => {
        if (isFileOperationBlocked(get)) return false;
        const result = await window.api.game.launchActiveGameBundle(options);
        if (result.status === "launched" || result.status === "already-running") {
            get().setRuntimeState(result.runtime);
            return true;
        }
        setResultError(set, result.message);
        return false;
    },

    stopGame: async () => {
        const result = await window.api.game.stop();
        get().setRuntimeState(result.runtime);
        if (result.status === "error") {
            setResultError(set, result.message);
            return false;
        }
        return true;
    },

    createManualBackup: async (options = {}) => {
        if (isFileOperationBlocked(get)) return false;
        const result = await window.api.game.createManualBackup(options);
        if (result.status === "created") {
            set({ backupSummary: result.summary });
            return true;
        }
        if (result.status === "error" || result.status === "unavailable" || result.status === "blocked") setResultError(set, result.message);
        else console.info(`[game-backup] ${result.message}`);
        return false;
    },

    restoreBackup: async (backupId) => {
        if (isFileOperationBlocked(get)) return false;
        const result = await window.api.game.restoreBackup(backupId);
        if (result.status === "restored") {
            set({ backupSummary: result.summary });
            await get().refresh(false);
            return true;
        }
        if (result.status === "error" || result.status === "unavailable" || result.status === "blocked") setResultError(set, result.message);
        return false;
    },

    deleteBackup: async (backupId) => {
        if (isFileOperationBlocked(get)) return false;
        const result = await window.api.game.deleteBackup(backupId);
        if (result.status === "deleted") {
            set({ backupSummary: result.summary });
            return true;
        }
        setResultError(set, result.message);
        return false;
    },

    renameBackup: async (backupId, comment) => {
        if (isFileOperationBlocked(get)) return false;
        const result = await window.api.game.renameBackup(backupId, comment);
        if (result.status === "renamed") {
            set({ backupSummary: result.summary });
            return true;
        }
        setResultError(set, result.message);
        return false;
    },

    setRuntimeState: (runtimeState) => {
        set((current) => ({
            state: current.state.status === "ready" ? { ...current.state, runtimeState } : current.state
        }));
    },

    setReleaseNotesLoading: (isLoadingReleaseNotes) => set({ isLoadingReleaseNotes }),
    setError: (message) => set({ state: { status: "error", message } })
}));

export function selectIsGameBundleInstallRunning(state: Pick<GameBundleStoreState, "isInstallingGameBundle" | "installProgress">): boolean {
    return isGameBundleInstallRunning(state.isInstallingGameBundle, state.installProgress);
}
