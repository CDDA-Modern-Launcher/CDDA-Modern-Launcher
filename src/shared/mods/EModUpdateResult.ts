import { ModRepositoryState } from "./ModRepositoryState";
import { ModInstanceInfo } from "./ModInstanceInfo";

export type EModUpdateResult =
    | { status: "updated"; state: ModRepositoryState; mod: ModInstanceInfo }
    | { status: "blocked-by-local-changes"; state: ModRepositoryState; mod: ModInstanceInfo }
    | { status: "error"; message: string; state: ModRepositoryState };
