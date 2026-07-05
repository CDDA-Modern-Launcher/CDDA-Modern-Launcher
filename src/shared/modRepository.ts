export const MOD_REPOSITORY_DIRECTORY_NAME = "mod-repository";
export const MOD_REPOSITORY_REGISTRY_FILE_NAME = "mods.json";
export const MOD_REPOSITORY_SCHEMA_VERSION = 1;

export type ModSourceProvider = "github" | "gitlab" | "generic";

export type ModRepositoryItemStatus =
    | "installed"
    | "checking"
    | "update-available"
    | "updating"
    | "missing-local-copy"
    | "restoring"
    | "invalid-local-copy"
    | "blocked-by-local-changes"
    | "error";

export type InstalledMod = {
    schemaVersion: 1;
    id: string;
    displayName: string;
    sourceUrl: string;
    provider: ModSourceProvider;
    defaultBranch: string;
    trackingRef: string;
    installedCommit: string;
    lastKnownRemoteCommit: string;
    hasLocalChanges: boolean;
    updateAvailable: boolean;
    relativePath: string;
    installedAt: string;
    checkedAt?: string;
    updatedAt: string;
    enabled: boolean;
};

export type ModRegistry = {
    schemaVersion: 1;
    mods: Record<string, InstalledMod>;
};

export type ModRepositoryItem = InstalledMod & {
    status: ModRepositoryItemStatus;
    absolutePath: string;
    error?: string;
};

export type ModRepositoryState = {
    status: "unconfigured" | "ready" | "error";
    repositoryPath?: string;
    channelId?: string;
    modRepositoryPath?: string;
    mods: ModRepositoryItem[];
    checking: boolean;
    message?: string;
};

export type InstallModResult = { status: "installed"; state: ModRepositoryState; mod: ModRepositoryItem } | { status: "error"; message: string; state: ModRepositoryState };

export type CheckModsResult = { status: "checked"; state: ModRepositoryState } | { status: "error"; message: string; state: ModRepositoryState };

export type UpdateModOptions = {
    force?: boolean;
};

export type UpdateModResult =
    | { status: "updated"; state: ModRepositoryState; mod: ModRepositoryItem }
    | { status: "blocked-by-local-changes"; state: ModRepositoryState; mod: ModRepositoryItem }
    | { status: "error"; message: string; state: ModRepositoryState };

export type RemoveModResult = { status: "removed"; state: ModRepositoryState } | { status: "error"; message: string; state: ModRepositoryState };

export type OpenModFolderResult = { status: "opened" } | { status: "error"; message: string };

export type ModRepositoryChangedEvent = {
    state: ModRepositoryState;
};

export type ModRepositoryNoticeEvent = {
    type: "updates-available";
    updateCount: number;
    dirtyCount: number;
    state: ModRepositoryState;
};
