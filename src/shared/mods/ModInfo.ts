import { ModSourceType } from "./ModSourceType";

export type ModInfo = {
    schemaVersion: 2;
    id: string;
    displayName: string;
    description?: string;
    sourceType: ModSourceType;
    sourceId: string;
    sourceUrl?: string;
    sourcePath: string;
    subdirectory: string;
    defaultBranch?: string;
    trackingRef?: string;
    installedCommit?: string;
    lastKnownRemoteCommit?: string;
    hasLocalChanges: boolean;
    updateAvailable: boolean;
    installedAt: string;
    checkedAt?: string;
    updatedAt: string;
    enabled: boolean;
};
