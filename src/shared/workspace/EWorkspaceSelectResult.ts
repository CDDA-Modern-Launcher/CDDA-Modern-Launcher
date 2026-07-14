import { WorkspaceStatus } from "./WorkspaceStatus";

export type EWorkspaceSelectResult = { status: "cancelled" } | { status: "selected"; workspace: WorkspaceStatus };
