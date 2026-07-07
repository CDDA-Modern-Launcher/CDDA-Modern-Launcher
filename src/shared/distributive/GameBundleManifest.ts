export type GameBundleManifest = {
    schemaVersion: 1;
    channelId: string;
    releaseId: string;
    releaseName: string;
    tagName: string;
    publishedAt: string;
    htmlUrl: string;
    releaseBody?: string;
    assetName: string;
    installedAt: string;
    executablePath: string | null;
    userdataPath: string;
    copiedUserdataFromInstallId: string | null;
    source: {
        owner: string;
        repo: string;
        branch: string;
    };
};
