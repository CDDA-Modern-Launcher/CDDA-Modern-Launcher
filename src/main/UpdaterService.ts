import { is } from "@electron-toolkit/utils";
import { app, BrowserWindow, ipcMain } from "electron";
import { autoUpdater, ProgressInfo, UpdateInfo } from "electron-updater";
import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";

import { Bridge } from "../shared/bridge-api/Bridge";
import { UpdateState } from "../shared/bridge-api/types/UpdateState";
import { LocaleKeys } from "../shared/localization/types/LocaleFile";
import { translate } from "./LocalizationService";

const DOWNLOAD_PROGRESS_MIN_INTERVAL_MS = 250;

export class UpdaterService {
    private state: UpdateState = { status: "idle" };
    private skippedVersion: string | null = null;
    private lastPublishedDownloadProgressKey: string | null = null;
    private lastPublishedDownloadProgressAt = 0;

    constructor() {
        ipcMain.handle(Bridge.Updater.getState, () => this.getState());
        ipcMain.handle(Bridge.Updater.checkNow, () => this.checkNow());
        ipcMain.handle(Bridge.Updater.downloadNow, () => this.downloadNow());
        ipcMain.handle(Bridge.Updater.installNow, () => this.installNow());
        ipcMain.handle(Bridge.Updater.dismiss, () => this.dismiss());
        ipcMain.handle(Bridge.Updater.skipVersion, (_event, version: string) => this.skipVersion(version));
    }

    initialize(): void {
        if (is.dev || !app.isPackaged) {
            this.log("[updater] skipped in dev/unpackaged mode");
            return;
        }

        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = false;

        autoUpdater.on("checking-for-update", () => {
            this.setState({ status: "checking" });
        });

        autoUpdater.on("update-available", (info) => {
            const version = this.getUpdateVersion(info);

            if (this.shouldIgnoreVersion(version)) {
                this.log("[updater] update ignored by user", { version });
                this.setState({ status: "skipped", version });
                return;
            }

            this.setState({ status: "available", version });
        });

        autoUpdater.on("update-not-available", (info) => {
            this.setState({ status: "not-available", version: info.version });
        });

        autoUpdater.on("download-progress", (progress: ProgressInfo) => {
            const version = this.state.status === "available" || this.state.status === "downloading" ? this.state.version : "unknown";

            this.setDownloadState({
                status: "downloading",
                version,
                percent: Math.max(0, Math.min(100, Math.round(progress.percent))),
                transferredBytes: this.getKnownByteCount(progress.transferred),
                totalBytes: this.getKnownTotalBytes(progress.total)
            });
        });

        autoUpdater.on("update-downloaded", (info) => {
            const version = this.getUpdateVersion(info);

            if (this.shouldIgnoreVersion(version)) {
                this.setState({ status: "skipped", version });
                return;
            }

            this.setState({ status: "downloaded", version });
        });

        autoUpdater.on("error", (error) => {
            this.log("[updater] error", {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            this.setState(this.getErrorState(this.getFriendlyErrorKey(error)));
        });

        void this.checkForUpdates();
    }

    getState(): UpdateState {
        return this.state;
    }

    async checkNow(): Promise<UpdateState> {
        if (is.dev || !app.isPackaged) {
            this.setState(this.getErrorState("updater.error.packaged.only"));
            return this.state;
        }

        await this.checkForUpdates();
        return this.state;
    }

    async downloadNow(): Promise<UpdateState> {
        if (this.state.status !== "available") {
            this.setState(this.getErrorState("updater.error.not.available"));
            return this.state;
        }

        const version = this.state.version;
        this.setDownloadState({ status: "downloading", version, percent: 0 }, true);
        await autoUpdater.downloadUpdate();
        return this.state;
    }

    installNow(): boolean {
        if (this.state.status !== "downloaded") {
            this.setState(this.getErrorState("updater.error.not.downloaded"));
            return false;
        }

        autoUpdater.quitAndInstall();
        return true;
    }

    dismiss(): UpdateState {
        this.setState({ status: "idle" });
        return this.state;
    }

    skipVersion(version: string): UpdateState {
        this.skippedVersion = version;
        this.setState({ status: "skipped", version });
        return this.state;
    }

    private async checkForUpdates(): Promise<void> {
        try {
            await autoUpdater.checkForUpdates();
        } catch (error) {
            this.log("[updater] check failed", {
                name: error instanceof Error ? error.name : undefined,
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
            this.setState(this.getErrorState(this.getFriendlyErrorKey(error)));
        }
    }

    private setState(state: UpdateState): void {
        this.state = state;

        if (state.status !== "downloading") {
            this.lastPublishedDownloadProgressKey = null;
            this.lastPublishedDownloadProgressAt = 0;
        }

        this.publishState(state);
    }

    private setDownloadState(state: Extract<UpdateState, { status: "downloading" }>, immediate = false): void {
        this.state = state;

        if (!immediate && this.shouldThrottleDownloadProgress(state)) return;

        this.lastPublishedDownloadProgressKey = this.getDownloadProgressKey(state);
        this.lastPublishedDownloadProgressAt = Date.now();
        this.publishState(state);
    }

    private shouldThrottleDownloadProgress(state: Extract<UpdateState, { status: "downloading" }>): boolean {
        const key = this.getDownloadProgressKey(state);
        return key === this.lastPublishedDownloadProgressKey && Date.now() - this.lastPublishedDownloadProgressAt < DOWNLOAD_PROGRESS_MIN_INTERVAL_MS;
    }

    private getDownloadProgressKey(state: Extract<UpdateState, { status: "downloading" }>): string {
        const totalBytes = state.totalBytes === undefined ? "unknown" : state.totalBytes;
        return `${state.version}:${state.percent}:${totalBytes}`;
    }

    private getKnownByteCount(value: number | undefined): number | undefined {
        if (value === undefined || !Number.isFinite(value) || value < 0) return undefined;
        return Math.round(value);
    }

    private getKnownTotalBytes(value: number | undefined): number | undefined {
        const bytes = this.getKnownByteCount(value);
        return bytes === undefined || bytes === 0 ? undefined : bytes;
    }

    private publishState(state: UpdateState): void {
        this.log("[updater] state changed", state);

        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send(Bridge.Updater.onStateChanged, state);
        }
    }

    private getUpdateVersion(info: UpdateInfo): string {
        return info.version || "unknown";
    }

    private shouldIgnoreVersion(version: string): boolean {
        return this.skippedVersion !== null && this.skippedVersion === version;
    }

    private getFriendlyErrorKey(error: unknown): LocaleKeys {
        const message = error instanceof Error ? error.message : String(error);

        if (message.includes("latest.yml") && message.includes("404")) {
            return "updater.error.metadata.missing";
        }

        return "updater.error.check.failed";
    }

    private getErrorState(messageKey: LocaleKeys): UpdateState {
        return { status: "error", messageKey, message: translate(messageKey) };
    }

    private log(message: string, data?: unknown): void {
        const text = data === undefined ? message : `${message} ${JSON.stringify(data)}`;
        const line = `[${new Date().toISOString()}] ${text}\n`;

        console.log(line.trimEnd());

        try {
            const logDir = join(app.getPath("userData"), "logs");
            mkdirSync(logDir, { recursive: true });
            appendFileSync(join(logDir, "updater.log"), line, "utf8");
        } catch (error) {
            console.error("[updater] failed to write log", error);
        }
    }
}

export const updaterService = new UpdaterService();
