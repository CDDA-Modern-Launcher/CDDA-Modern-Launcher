import { WorkspaceStatus } from "./WorkspaceStatus";

export type EWorkspaceSelectResult = { status: "cancelled" } | { status: "selected"; repository: WorkspaceStatus };
