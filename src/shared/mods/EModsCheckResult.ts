import { ModRepositoryState } from "./ModRepositoryState";

export type EModsCheckResult = { status: "checked"; state: ModRepositoryState } | { status: "error"; message: string; state: ModRepositoryState };
