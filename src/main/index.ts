import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { app, BrowserWindow, dialog, nativeTheme, shell } from "electron";
import { join } from "path";

import icon from "../../resources/icon.png?asset";
import { setupAppearanceIpc } from "./ipc/setupAppearanceIpc";
import { GameBundleService } from "./GameBundleService";
import { setupGameBundleIpc } from "./ipc/setupGameBundleIpc";
import { setupLocalizationIpc } from "./ipc/setupLocalizationIpc";
import { ModRepositoryService } from "./mods/ModRepositoryService";
import { setupModRepositoryIpc } from "./ipc/setupModRepositoryIpc";
import { WorkspaceService } from "./repository/WorkspaceService";
import { setupWorkspaceIpc } from "./ipc/setupWorkspaceIpc";
import { appSettings } from "./settings/AppSettings";
import { setupLauncherSettingsIpc } from "./ipc/setupLauncherSettingsIpc";
import { setupShellIpc } from "./ipc/setupShellIpc";
import { UpdaterService } from "./UpdaterService";
import { setupUpdaterIpc } from "./ipc/setupUpdaterIpc";
import { l10n } from "./Localization";

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
        l10n.initialize();

        const repositoryService = new WorkspaceService();
        const gameBundleService = new GameBundleService(repositoryService);
        const modRepositoryService = new ModRepositoryService(repositoryService);
        const updaterService = new UpdaterService();

        setupAppearanceIpc();
        setupLocalizationIpc();
        setupLauncherSettingsIpc(repositoryService);
        setupWorkspaceIpc(repositoryService);
        setupGameBundleIpc(gameBundleService);
        setupModRepositoryIpc(modRepositoryService);
        setupUpdaterIpc(updaterService);
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
