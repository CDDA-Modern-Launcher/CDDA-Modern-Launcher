import { ModRepositoryState } from "./ModRepositoryState";

export type EModDeleteResult = { status: "deleted"; state: ModRepositoryState } | { status: "error"; message: string; state: ModRepositoryState };
