import { ModRepositoryState } from "./ModRepositoryState";
import { ModInstanceInfo } from "./ModInstanceInfo";

export type EModInstallResult = { status: "installed"; state: ModRepositoryState; mod: ModInstanceInfo } | { status: "error"; message: string; state: ModRepositoryState };
