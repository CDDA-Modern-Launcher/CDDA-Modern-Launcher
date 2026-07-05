import { type FSWatcher, watch } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import { basename, join, normalize } from "node:path";

type GameSaveMonitorOptions = {
    userdataPath: string;
    settleDelayMs?: number;
    onSettled: (activity: GameSaveSettledActivity) => void | Promise<void>;
    onStabilityChanged?: (stable: boolean) => void;
};

export type GameSaveSettledActivity = {
    changedPaths: string[];
    keyChangedPaths: string[];
    eventCount: number;
    keyEventCount: number;
    hasSaveFileChange: boolean;
    hasMasterSaveChange: boolean;
    hasPlayerSaveArchiveChange: boolean;
};

type WatchTargetKind = "userdata" | "save-root" | "world" | "key-file";

type WatchTarget = {
    path: string;
    kind: WatchTargetKind;
};

type RegisteredActivity = {
    shouldSettle: boolean;
    shouldRebuildWatchers: boolean;
};

const DEFAULT_SETTLE_DELAY_MS = 1500;
const WATCH_REBUILD_DELAY_MS = 300;
const SAVE_DIRECTORY_NAME = "save";
const MASTER_SAVE_FILE_NAME = "master.gsav";
const PLAYER_SAVE_ARCHIVE_EXTENSION = ".sav.zzip";

export class GameSaveMonitor {
    private readonly userdataPath: string;
    private readonly savePath: string;
    private readonly settleDelayMs: number;
    private readonly onSettled: (activity: GameSaveSettledActivity) => void | Promise<void>;
    private readonly onStabilityChanged?: (stable: boolean) => void;
    private readonly watchers = new Map<string, FSWatcher>();
    private readonly watcherKinds = new Map<string, WatchTargetKind>();
    private readonly pendingChangedPaths = new Set<string>();
    private readonly pendingKeyChangedPaths = new Set<string>();
    private settleTimer: NodeJS.Timeout | null = null;
    private rebuildTimer: NodeJS.Timeout | null = null;
    private stopped = false;
    private settling = false;
    private pendingSettledRun = false;
    private pendingEventCount = 0;
    private pendingKeyEventCount = 0;
    private pendingMasterSaveChange = false;
    private pendingPlayerSaveArchiveChange = false;

    constructor(options: GameSaveMonitorOptions) {
        this.userdataPath = normalize(options.userdataPath);
        this.savePath = join(this.userdataPath, SAVE_DIRECTORY_NAME);
        this.settleDelayMs = options.settleDelayMs ?? DEFAULT_SETTLE_DELAY_MS;
        this.onSettled = options.onSettled;
        this.onStabilityChanged = options.onStabilityChanged;
    }

    isStable(): boolean {
        return this.settleTimer === null && !this.settling && this.pendingEventCount === 0;
    }

    async start(): Promise<void> {
        console.info(`[game-save] monitor start userdata=${this.userdataPath}`);
        await mkdir(this.userdataPath, { recursive: true });
        await this.rebuildWatchers();
    }

    stop(): void {
        this.stopped = true;
        this.clearSettleTimer();
        this.clearRebuildTimer();
        for (const [path, watcher] of this.watchers) {
            watcher.close();
            console.debug(`[game-save] unwatch ${this.watcherKinds.get(path) ?? "unknown"} ${path}`);
        }
        this.watchers.clear();
        this.watcherKinds.clear();
        this.resetPendingActivity();
        console.info(`[game-save] monitor stop userdata=${this.userdataPath}`);
    }

    private async rebuildWatchers(): Promise<void> {
        if (this.stopped) return;

        const nextTargets = new Map<string, WatchTargetKind>([[this.userdataPath, "userdata"]]);
        if (await directoryExists(this.savePath)) {
            nextTargets.set(this.savePath, "save-root");
            for (const worldPath of await listWorldDirectories(this.savePath)) {
                nextTargets.set(worldPath, "world");
                for (const keyFilePath of await listExistingKeySaveFiles(worldPath)) nextTargets.set(keyFilePath, "key-file");
            }
        }

        let addedCount = 0;
        let removedCount = 0;
        for (const [path, watcher] of this.watchers) {
            if (!nextTargets.has(path)) {
                watcher.close();
                this.watchers.delete(path);
                this.watcherKinds.delete(path);
                removedCount += 1;
                console.debug(`[game-save] unwatch ${path}`);
            }
        }
        for (const [path, kind] of nextTargets) {
            if (!this.watchers.has(path)) {
                this.watchPath({ path, kind });
                addedCount += 1;
            } else {
                this.watcherKinds.set(path, kind);
            }
        }

        if (addedCount > 0 || removedCount > 0) {
            console.info(
                `[game-save] watchers rebuilt added=${addedCount} removed=${removedCount} total=${this.watchers.size} worlds=${countWatchers(this.watcherKinds, "world")} keyFiles=${countWatchers(this.watcherKinds, "key-file")}`
            );
        }
    }

    private watchPath(target: WatchTarget): void {
        try {
            const watcher = watch(target.path, { persistent: false }, (eventType, filename) => {
                const activity = this.registerActivity(target, eventType, filename);
                if (activity.shouldSettle) this.scheduleSettle();
                if (activity.shouldRebuildWatchers) this.scheduleRebuildWatchers();
            });
            watcher.on("error", (error) => {
                if (!this.stopped) {
                    console.error(`[game-save] watcher failed kind=${target.kind} path=${target.path}`, error);
                    this.watchers.delete(target.path);
                    this.watcherKinds.delete(target.path);
                    this.scheduleSettle();
                    this.scheduleRebuildWatchers();
                }
            });
            this.watchers.set(target.path, watcher);
            this.watcherKinds.set(target.path, target.kind);
            console.debug(`[game-save] watch ${target.kind} ${target.path}`);
        } catch (error) {
            if (!this.stopped) console.error(`[game-save] failed to watch kind=${target.kind} path=${target.path}`, error);
        }
    }

    private registerActivity(target: WatchTarget, eventType: string, filename: string | Buffer | null): RegisteredActivity {
        const changedPath = resolveChangedPath(target, filename);

        if (target.kind === "userdata") {
            return this.registerUserdataActivity(eventType, changedPath);
        }

        if (target.kind === "save-root") {
            return this.registerSaveRootActivity(eventType, changedPath);
        }

        if (target.kind === "world" && filename === null) {
            console.debug(`[game-save] world structure event type=${eventType} path=${changedPath}`);
            return { shouldSettle: false, shouldRebuildWatchers: true };
        }

        const keyKind = getKeySaveFileKind(changedPath);
        if (keyKind === null) {
            return { shouldSettle: false, shouldRebuildWatchers: false };
        }

        this.pendingEventCount += 1;
        this.pendingKeyEventCount += 1;
        this.pendingChangedPaths.add(changedPath);
        this.pendingKeyChangedPaths.add(changedPath);
        if (keyKind === "master") this.pendingMasterSaveChange = true;
        else this.pendingPlayerSaveArchiveChange = true;
        console.info(`[game-save] key event type=${eventType} kind=${keyKind} path=${changedPath}`);

        return { shouldSettle: true, shouldRebuildWatchers: true };
    }

    private registerUserdataActivity(eventType: string, changedPath: string): RegisteredActivity {
        if (normalize(changedPath) !== this.savePath) {
            return { shouldSettle: false, shouldRebuildWatchers: false };
        }

        console.debug(`[game-save] save directory event type=${eventType} path=${changedPath}`);
        return { shouldSettle: false, shouldRebuildWatchers: true };
    }

    private registerSaveRootActivity(eventType: string, changedPath: string): RegisteredActivity {
        console.debug(`[game-save] save structure event type=${eventType} path=${changedPath}`);
        return { shouldSettle: false, shouldRebuildWatchers: true };
    }

    private scheduleSettle(): void {
        if (this.isStable()) this.onStabilityChanged?.(false);
        this.clearSettleTimer();
        this.settleTimer = setTimeout(() => {
            this.settleTimer = null;
            void this.runSettledCallback();
        }, this.settleDelayMs);
    }

    private async runSettledCallback(): Promise<void> {
        if (this.stopped) return;
        if (this.settling) {
            this.pendingSettledRun = true;
            return;
        }
        const activity = this.consumePendingActivity();
        if (activity.eventCount === 0) return;

        console.info(
            `[game-save] settled events=${activity.eventCount} keyEvents=${activity.keyEventCount} changedPaths=${activity.changedPaths.length} keyPaths=${activity.keyChangedPaths.length} realSave=${activity.hasSaveFileChange ? "yes" : "no"}`
        );
        if (!activity.hasSaveFileChange) {
            if (this.isStable()) this.onStabilityChanged?.(true);
            return;
        }

        this.settling = true;
        try {
            await this.onSettled(activity);
        } catch (error) {
            console.error("[game-save] failed to process settled save activity", error);
        } finally {
            this.settling = false;
            if (this.pendingSettledRun) {
                this.pendingSettledRun = false;
                this.scheduleSettle();
            } else if (this.isStable()) {
                this.onStabilityChanged?.(true);
            }
        }
    }

    private consumePendingActivity(): GameSaveSettledActivity {
        const activity: GameSaveSettledActivity = {
            changedPaths: [...this.pendingChangedPaths].sort(),
            keyChangedPaths: [...this.pendingKeyChangedPaths].sort(),
            eventCount: this.pendingEventCount,
            keyEventCount: this.pendingKeyEventCount,
            hasSaveFileChange: this.pendingMasterSaveChange || this.pendingPlayerSaveArchiveChange,
            hasMasterSaveChange: this.pendingMasterSaveChange,
            hasPlayerSaveArchiveChange: this.pendingPlayerSaveArchiveChange
        };
        this.resetPendingActivity();
        return activity;
    }

    private resetPendingActivity(): void {
        this.pendingChangedPaths.clear();
        this.pendingKeyChangedPaths.clear();
        this.pendingEventCount = 0;
        this.pendingKeyEventCount = 0;
        this.pendingMasterSaveChange = false;
        this.pendingPlayerSaveArchiveChange = false;
    }

    private scheduleRebuildWatchers(): void {
        if (this.rebuildTimer !== null) return;
        this.rebuildTimer = setTimeout(() => {
            this.rebuildTimer = null;
            void this.rebuildWatchers();
        }, WATCH_REBUILD_DELAY_MS);
    }

    private clearSettleTimer(): void {
        if (this.settleTimer !== null) {
            clearTimeout(this.settleTimer);
            this.settleTimer = null;
        }
    }

    private clearRebuildTimer(): void {
        if (this.rebuildTimer !== null) {
            clearTimeout(this.rebuildTimer);
            this.rebuildTimer = null;
        }
    }
}

async function listWorldDirectories(savePath: string): Promise<string[]> {
    try {
        const entries = await readdir(savePath, { withFileTypes: true });
        return entries.filter((entry) => entry.isDirectory()).map((entry) => join(savePath, entry.name));
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return [];
        throw error;
    }
}

async function listExistingKeySaveFiles(worldPath: string): Promise<string[]> {
    try {
        const entries = await readdir(worldPath, { withFileTypes: true });
        return entries.filter((entry) => entry.isFile() && getKeySaveFileKind(entry.name) !== null).map((entry) => join(worldPath, entry.name));
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return [];
        throw error;
    }
}

async function directoryExists(path: string): Promise<boolean> {
    try {
        return (await stat(path)).isDirectory();
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return false;
        throw error;
    }
}

function resolveChangedPath(target: WatchTarget, filename: string | Buffer | null): string {
    if (target.kind === "key-file") return target.path;
    return filename === null ? target.path : join(target.path, filename.toString());
}

function getKeySaveFileKind(path: string): "master" | "player" | null {
    const name = basename(path).toLowerCase();
    if (name === MASTER_SAVE_FILE_NAME) return "master";
    if (name.endsWith(PLAYER_SAVE_ARCHIVE_EXTENSION)) return "player";
    return null;
}

function countWatchers(watcherKinds: Map<string, WatchTargetKind>, kind: WatchTargetKind): number {
    let count = 0;
    for (const watcherKind of watcherKinds.values()) {
        if (watcherKind === kind) count += 1;
    }
    return count;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error;
}
