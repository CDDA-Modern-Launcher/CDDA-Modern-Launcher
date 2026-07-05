import { BrowserWindow, dialog, ipcMain } from "electron";

import { LocalizationService } from "../localization/LocalizationService";
import { LocalRepositoryService } from "./LocalRepositoryService";
import { EWorkspaceSelectResult } from "../../shared/workspace/EWorkspaceSelectResult";

export function setupRepositoryIpc(repositoryService: LocalRepositoryService, localizationService: LocalizationService): void {
    ipcMain.handle("repository:get-status", () => repositoryService.getInitialStatus());

    ipcMain.handle("repository:set-selected-channel", (_event, channelId: string) => repositoryService.setSelectedChannel(channelId));

    ipcMain.handle("repository:select-folder", async (event): Promise<EWorkspaceSelectResult> => {
        const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined;
        const options = {
            title: localizationService.t("repository.dialog.selectFolder.title"),
            properties: ["openDirectory", "createDirectory"] as Array<"openDirectory" | "createDirectory">
        };
        const result = owner === undefined ? await dialog.showOpenDialog(options) : await dialog.showOpenDialog(owner, options);

        if (result.canceled || result.filePaths.length === 0) {
            return { status: "cancelled" };
        }

        return {
            status: "selected",
            repository: await repositoryService.useRepository(result.filePaths[0])
        };
    });
}
