import { WorkspaceStatus } from "../workspace/WorkspaceStatus";
import { EWorkspaceSelectResult } from "../workspace/EWorkspaceSelectResult";

export type RepositoryApi = {
    getStatus: () => Promise<WorkspaceStatus>;
    selectFolder: () => Promise<EWorkspaceSelectResult>;
    setSelectedChannel: (channelId: string) => Promise<WorkspaceStatus>;
};
