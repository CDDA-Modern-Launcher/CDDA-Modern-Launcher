import { ModRepositoryState } from "./ModRepositoryState";

export type EModInstallResult = { status: "installed"; state: ModRepositoryState } | { status: "cancelled"; state: ModRepositoryState } | { status: "error"; message: string; state: ModRepositoryState };
