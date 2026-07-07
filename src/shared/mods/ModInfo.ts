export type ModInfo = {
    schemaVersion: 1;
    id: string;
    displayName: string;
    sourceUrl: string;
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
