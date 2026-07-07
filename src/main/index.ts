import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import { autoUpdater, ProgressInfo, UpdateInfo } from "electron-updater";
import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";

import icon from "../../resources/icon.png?asset";
import { registerMainAppearanceApi } from "./appearance/registerMainAppearanceApi";
import { GameInstallationService } from "./game/GameInstallationService";
import { setupGameInstallationIpc } from "./game/setupGameInstallationIpc";
import { LocalizationService } from "./localization/LocalizationService";
import { setupLocalizationIpc } from "./localization/setupLocalizationIpc";
import { ModRepositoryService } from "./mods/ModRepositoryService";
import { setupModRepositoryIpc } from "./mods/setupModRepositoryIpc";
import { LocalRepositoryService } from "./repository/LocalRepositoryService";
import { setupRepositoryIpc } from "./repository/setupRepositoryIpc";
import { LauncherSettingsStore } from "./settings/LauncherSettingsStore";
import { setupLauncherSettingsIpc } from "./settings/setupLauncherSettingsIpc";

type UpdateState =
    | { status: "idle" }
    | { status: "checking" }
    | { status: "available"; version: string }
    | { status: "downloading"; version: string; percent: number }
    | { status: "downloaded"; version: string }
    | { status: "not-available"; version?: string }
    | { status: "skipped"; version: string }
    | { status: "error"; message: string; messageKey?: string };

let updateState: UpdateState = { status: "idle" };
let skippedVersion: string | null = null;
let mockUpdateTimer: NodeJS.Timeout | null = null;
let hasMockDownloadedUpdate = false;

function logUpdater(message: string, data?: unknown): void {
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

function setUpdateState(state: UpdateState): void {
    updateState = state;
    logUpdater("[updater] state changed", state);

    for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send("updater:state-changed", state);
    }
}

function getUpdateVersion(info: UpdateInfo): string {
    return info.version || "unknown";
}

function shouldIgnoreVersion(version: string): boolean {
    return skippedVersion !== null && skippedVersion === version;
}

function getFriendlyUpdateErrorKey(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("latest.yml") && message.includes("404")) {
        return "updater.error.metadataMissing";
    }

    return "updater.error.checkFailed";
}

function getUpdateErrorState(messageKey: string, localizationService: LocalizationService): UpdateState {
    return { status: "error", messageKey, message: localizationService.t(messageKey) };
}

function setupUpdaterIpc(localizationService: LocalizationService): void {
    ipcMain.handle("updater:get-state", () => updateState);

    ipcMain.handle("updater:check-now", async () => {
        if (is.dev || !app.isPackaged) {
            setUpdateState({
                status: "error",
                messageKey: "updater.error.packagedOnly",
                message: localizationService.t("updater.error.packagedOnly")
            });
            return updateState;
        }

        await autoUpdater.checkForUpdates();
        return updateState;
    });

    ipcMain.handle("updater:install-now", () => {
        if (updateState.status !== "downloaded") {
            setUpdateState(getUpdateErrorState("updater.error.notDownloaded", localizationService));
            return false;
        }

        if (hasMockDownloadedUpdate) {
            hasMockDownloadedUpdate = false;
            logUpdater("[updater] mock install requested; no real installer will be launched");
            setUpdateState({ status: "idle" });
            return false;
        }

        autoUpdater.quitAndInstall();
        return true;
    });

    ipcMain.handle("updater:dismiss", () => {
        setUpdateState({ status: "idle" });
        return updateState;
    });

    ipcMain.handle("updater:skip-version", (_event, version: string) => {
        skippedVersion = version;
        setUpdateState({ status: "skipped", version });
        return updateState;
    });

    ipcMain.handle("updater:mock-downloaded", (_event, version?: string) => {
        simulateDownloadedUpdate(version);
        return updateState;
    });
}

function simulateDownloadedUpdate(version = app.getVersion()): void {
    if (mockUpdateTimer !== null) {
        clearTimeout(mockUpdateTimer);
        mockUpdateTimer = null;
    }

    hasMockDownloadedUpdate = false;
    setUpdateState({ status: "checking" });

    mockUpdateTimer = setTimeout(() => {
        setUpdateState({ status: "available", version });

        mockUpdateTimer = setTimeout(() => {
            setUpdateState({ status: "downloading", version, percent: 37 });

            mockUpdateTimer = setTimeout(() => {
                setUpdateState({ status: "downloading", version, percent: 100 });

                mockUpdateTimer = setTimeout(() => {
                    hasMockDownloadedUpdate = true;
                    setUpdateState({ status: "downloaded", version });
                    mockUpdateTimer = null;
                }, 400);
            }, 700);
        }, 700);
    }, 500);
}

function setupAutoUpdater(localizationService: LocalizationService): void {
    if (is.dev || !app.isPackaged) {
        logUpdater("[updater] skipped in dev/unpackaged mode");
        return;
    }

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.on("checking-for-update", () => {
        setUpdateState({ status: "checking" });
    });

    autoUpdater.on("update-available", (info) => {
        const version = getUpdateVersion(info);

        if (shouldIgnoreVersion(version)) {
            logUpdater("[updater] update ignored by user", { version });
            setUpdateState({ status: "skipped", version });
            return;
        }

        setUpdateState({ status: "available", version });
    });

    autoUpdater.on("update-not-available", (info) => {
        setUpdateState({ status: "not-available", version: info.version });
    });

    autoUpdater.on("download-progress", (progress: ProgressInfo) => {
        const version = updateState.status === "available" || updateState.status === "downloading" ? updateState.version : "unknown";

        setUpdateState({
            status: "downloading",
            version,
            percent: Math.max(0, Math.min(100, Math.round(progress.percent)))
        });
    });

    autoUpdater.on("update-downloaded", (info) => {
        hasMockDownloadedUpdate = false;
        const version = getUpdateVersion(info);

        if (shouldIgnoreVersion(version)) {
            setUpdateState({ status: "skipped", version });
            return;
        }

        setUpdateState({ status: "downloaded", version });
    });

    autoUpdater.on("error", (error) => {
        logUpdater("[updater] error", {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        setUpdateState(getUpdateErrorState(getFriendlyUpdateErrorKey(error), localizationService));
    });

    autoUpdater.checkForUpdates().catch((error) => {
        logUpdater("[updater] check failed", {
            name: error instanceof Error ? error.name : undefined,
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        setUpdateState(getUpdateErrorState(getFriendlyUpdateErrorKey(error), localizationService));
    });
}

function setupShellIpc(): void {
    ipcMain.handle("shell:open-external", async (_event, url: string) => {
        let parsed: URL;

        try {
            parsed = new URL(url);
        } catch {
            return false;
        }

        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
            return false;
        }

        await shell.openExternal(parsed.toString());
        return true;
    });
}

function createWindow(): void {
    const isDark = nativeTheme.shouldUseDarkColors;

    const mainWindow = new BrowserWindow({
        width: 980,
        height: 700,
        show: false,
        autoHideMenuBar: true,
        backgroundColor: isDark ? "#141517" : "#f8f9fa",
        ...(process.platform === "linux" ? { icon } : {}),
        webPreferences: {
            preload: join(__dirname, "../preload/index.js"),
            sandbox: false
        }
    });

    mainWindow.on("ready-to-show", () => {
        mainWindow.show();
    });

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url);
        return { action: "deny" };
    });

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
        mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    } else {
        mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
    }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
    // Set app user model id for windows
    electronApp.setAppUserModelId("io.github.CDDA-Modern-Launcher");

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on("browser-window-created", (_, window) => {
        optimizer.watchWindowShortcuts(window);
    });

    // IPC test
    ipcMain.on("ping", () => console.log("pong"));

    const settingsStore = new LauncherSettingsStore();
    const localizationService = new LocalizationService(settingsStore);
    await localizationService.initialize();
    const repositoryService = new LocalRepositoryService(settingsStore, localizationService);
    const gameInstallationService = new GameInstallationService(repositoryService, localizationService);
    const modRepositoryService = new ModRepositoryService(repositoryService, localizationService);

    await registerMainAppearanceApi(settingsStore);
    setupLocalizationIpc(localizationService);
    setupLauncherSettingsIpc(repositoryService);
    setupRepositoryIpc(repositoryService, localizationService);
    setupGameInstallationIpc(gameInstallationService, localizationService);
    setupModRepositoryIpc(modRepositoryService);
    setupUpdaterIpc(localizationService);
    setupShellIpc();
    createWindow();
    modRepositoryService.checkAllInBackground();
    setupAutoUpdater(localizationService);

    app.on("activate", function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
