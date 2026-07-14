import { BrowserWindow, dialog, ipcMain } from "electron";

import { WorkspaceService } from "../repository/WorkspaceService";
import { EWorkspaceSelectResult } from "../../shared/workspace/EWorkspaceSelectResult";
import { Bridge } from "../../shared/bridge-api/Bridge";
import { translate } from "../Localization";

export function setupWorkspaceIpc(repositoryService: WorkspaceService): void {
    ipcMain.handle(Bridge.Workspace.getStatus, () => repositoryService.getWorkspaceStatus());

    ipcMain.handle(Bridge.Workspace.setChannel, (_event, channelId: string) => repositoryService.setSelectedChannel(channelId));

    ipcMain.handle(Bridge.Workspace.selectNewFolder, async (event): Promise<EWorkspaceSelectResult> => {
        const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined;
        const options = { title: translate("repository.dialog.select.folder.title"), properties: ["openDirectory", "createDirectory"] as Array<"openDirectory" | "createDirectory"> };
        const result = owner === undefined ? await dialog.showOpenDialog(options) : await dialog.showOpenDialog(owner, options);

        if (result.canceled || result.filePaths.length === 0) return { status: "cancelled" };

        return { status: "selected", repository: await repositoryService.useRepository(result.filePaths[0]) };
    });
}
