import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { app, BrowserWindow, dialog, nativeTheme, shell } from "electron";
import { join } from "path";

import icon from "../../resources/icon.png?asset";
import { setupAppearanceIpc } from "./ipc/setupAppearanceIpc";
import { GameBundleService } from "./GameBundleService";
import { setupGameBundleIpc } from "./ipc/setupGameBundleIpc";
import { ModRepositoryService } from "./mods/ModRepositoryService";
import { setupModRepositoryIpc } from "./ipc/setupModRepositoryIpc";
import { workspaceService } from "./WorkspaceService";
import { appSettings } from "./settings/AppSettings";
import { setupShellIpc } from "./ipc/setupShellIpc";
import { updaterService } from "./UpdaterService";
import { l10n } from "./LocalizationService";
import { resolveWindowBounds, WindowState } from "./settings/WindowState";

function createWindow(): void {
    const isDark = nativeTheme.shouldUseDarkColors;
    const savedWindowState = appSettings.get("windowState");
    const bounds = resolveWindowBounds(savedWindowState.bounds);

    const mainWindow = new BrowserWindow({
        ...bounds,
        minWidth: 640,
        minHeight: 480,
        show: false,
        autoHideMenuBar: true,
        backgroundColor: isDark ? "#141517" : "#f8f9fa",
        ...(process.platform === "linux" ? { icon } : {}),
        webPreferences: {
            preload: join(__dirname, "../preload/index.js"),
            sandbox: false
        }
    });

    let normalBounds = bounds;
    let maximized = savedWindowState.maximized;

    const saveWindowState = (): void => {
        if (mainWindow.isDestroyed() || mainWindow.isMinimized() || mainWindow.isMaximized() || mainWindow.isFullScreen()) return;

        normalBounds = mainWindow.getBounds();
        maximized = false;
        appSettings.set({ windowState: { bounds: normalBounds, maximized } });
    };

    mainWindow.on("move", saveWindowState);
    mainWindow.on("resize", saveWindowState);
    mainWindow.on("maximize", () => {
        maximized = true;
        appSettings.set({ windowState: { bounds: normalBounds, maximized } });
    });
    mainWindow.on("unmaximize", () => {
        maximized = false;
        normalBounds = mainWindow.getNormalBounds();
        appSettings.set({ windowState: { bounds: normalBounds, maximized } });
    });
    mainWindow.on("close", () => {
        const state: WindowState = {
            bounds: mainWindow.isMinimized() || mainWindow.isMaximized() || mainWindow.isFullScreen() ? normalBounds : mainWindow.getBounds(),
            maximized: mainWindow.isMinimized() || mainWindow.isFullScreen() ? maximized : mainWindow.isMaximized()
        };
        appSettings.set({ windowState: state });
    });

    mainWindow.on("ready-to-show", () => {
        if (savedWindowState.maximized) {
            mainWindow.maximize();
        }
        mainWindow.show();
    });

    mainWindow.webContents.setWindowOpenHandler((details) => {
        void shell.openExternal(details.url);
        return { action: "deny" };
    });

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
        void mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    } else {
        void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
    }
}

// This method will be called when Electron has finished initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady()
    .then(async () => {
        // Set app user model id for windows
        electronApp.setAppUserModelId("io.github.CDDA-Modern-Launcher");

        // Default open or close DevTools by F12 in development
        // and ignore CommandOrControl + R in production.
        // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
        app.on("browser-window-created", (_, window) => {
            optimizer.watchWindowShortcuts(window);
        });

        await appSettings.initialize();

        let settingsFlushed = false;
        app.on("before-quit", (event) => {
            if (settingsFlushed) return;

            event.preventDefault();
            settingsFlushed = true;
            void appSettings.flush().finally(() => app.quit());
        });

        l10n.initialize();

        await workspaceService.initialize();

        const gameBundleService = new GameBundleService();
        const modRepositoryService = new ModRepositoryService();

        setupAppearanceIpc();
        setupGameBundleIpc(gameBundleService);
        setupModRepositoryIpc(modRepositoryService);
        setupShellIpc();
        createWindow();
        modRepositoryService.checkAllInBackground();

        updaterService.initialize();

        app.on("activate", function () {
            // On macOS it's common to re-create a window in the app when the dock icon is clicked and there are no other windows open.
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    })
    .catch((error: unknown) => {
        console.error("[app] initialization failed", error);
        dialog.showErrorBox("Application initialization failed", error instanceof Error ? (error.stack ?? error.message) : String(error));
        app.exit(1);
    });

// Quit when all windows are closed, except on macOS. There, it's common for applications and their menu bar to stay active until the user quits explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
