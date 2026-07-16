import { WorkspaceApi } from "../../shared/bridge-api/WorkspaceApi";
import { WorkspaceStatus } from "../../shared/workspace/WorkspaceStatus";
import { ipcRenderer } from "electron";
import { Bridge } from "../../shared/bridge-api/Bridge";
import { EWorkspaceSelectResult } from "../../shared/workspace/EWorkspaceSelectResult";

export function registerPreloadWorkspaceApi(): WorkspaceApi {
    return {
        getStatus: (): Promise<WorkspaceStatus> => ipcRenderer.invoke(Bridge.Workspace.getStatus),
        clear: (): Promise<WorkspaceStatus> => ipcRenderer.invoke(Bridge.Workspace.clear),
        selectNewFolder: (): Promise<EWorkspaceSelectResult> => ipcRenderer.invoke(Bridge.Workspace.selectNewFolder),
        setChannel: (channelId: string): Promise<WorkspaceStatus> => ipcRenderer.invoke(Bridge.Workspace.setChannel, channelId)
    };
}
