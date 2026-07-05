import { BrowserWindow, ipcMain, shell } from "electron";

import type { DeleteGameInstallOptions, InstallGameOptions, OpenGameFolderResult } from "../../shared/gameInstallations";
import { GameInstallationService } from "./GameInstallationService";

export function setupGameInstallationIpc(gameInstallationService: GameInstallationService): void {
    gameInstallationService.onProgress((progress) => {
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send("game:install-progress", progress);
        }
    });

    ipcMain.handle("game:get-state", (_event, refreshLatest: boolean | undefined) => gameInstallationService.getState(refreshLatest === true));
    ipcMain.handle("game:get-releases", () => gameInstallationService.getReleases());
    ipcMain.handle("game:install-latest", (_event, options: InstallGameOptions) => gameInstallationService.installLatest(options));
    ipcMain.handle("game:set-active-install", (_event, installId: string) => gameInstallationService.setActiveInstall(installId));
    ipcMain.handle("game:delete-install", (_event, installId: string, options: DeleteGameInstallOptions) => gameInstallationService.deleteInstall(installId, options));
    ipcMain.handle("game:launch-active-install", () => gameInstallationService.launchActiveInstall());
    ipcMain.handle("game:open-install-folder", async (_event, installId: string): Promise<OpenGameFolderResult> => openFolder(await gameInstallationService.getInstallFolder(installId)));
    ipcMain.handle("game:open-saves-folder", async (_event, installId: string): Promise<OpenGameFolderResult> => openFolder(await gameInstallationService.getSavesFolder(installId)));
}

async function openFolder(path: string | null): Promise<OpenGameFolderResult> {
    if (path === null) return { status: "unavailable", message: "Folder is not available." };
    const error = await shell.openPath(path);
    return error.length === 0 ? { status: "opened" } : { status: "error", message: error };
}
