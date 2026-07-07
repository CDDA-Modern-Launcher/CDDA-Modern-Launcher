import { WorkspaceStatus } from "../workspace/WorkspaceStatus";
import { EWorkspaceSelectResult } from "../workspace/EWorkspaceSelectResult";

export type WorkspaceApi = {
    getStatus: () => Promise<WorkspaceStatus>;
    selectNewFolder: () => Promise<EWorkspaceSelectResult>;
    setChannel: (channelId: string) => Promise<WorkspaceStatus>;
};
