export type GameChannelDefinition = {
    id: string;
    gameId: string;
    channelId: string;
    gameName: string;
    shortName: string;
    channelName: string;
    githubOwner: string;
    githubRepo: string;
    githubBranch: string;
    releasesUrl: string;
    assetNameIncludes: {
        windows: string[];
        linux: string[];
    };
    kind: "stable" | "experimental";
    source: "built-in" | "custom";
};
