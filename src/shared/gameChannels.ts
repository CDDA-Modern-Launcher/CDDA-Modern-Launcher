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

export const DEFAULT_GAME_CHANNEL_ID = "cdda-experimental";

export const BUILT_IN_GAME_CHANNELS: GameChannelDefinition[] = [
    {
        id: "cdda-experimental",
        gameId: "cdda",
        channelId: "experimental",
        gameName: "Cataclysm: Dark Days Ahead",
        shortName: "CDDA",
        channelName: "Experimental",
        githubOwner: "CleverRaven",
        githubRepo: "Cataclysm-DDA",
        githubBranch: "master",
        releasesUrl: "https://api.github.com/repos/CleverRaven/Cataclysm-DDA/releases",
        assetNameIncludes: {
            windows: ["windows-with-graphics-x64", "cdda-windows-tiles-x64"],
            linux: ["linux-with-graphics-x64", "cdda-linux-tiles-x64"]
        },
        kind: "experimental",
        source: "built-in"
    },
    {
        id: "cdda-stable",
        gameId: "cdda",
        channelId: "stable",
        gameName: "Cataclysm: Dark Days Ahead",
        shortName: "CDDA",
        channelName: "Stable",
        githubOwner: "CleverRaven",
        githubRepo: "Cataclysm-DDA",
        githubBranch: "0.I-branch",
        releasesUrl: "https://api.github.com/repos/CleverRaven/Cataclysm-DDA/releases",
        assetNameIncludes: {
            windows: ["windows-with-graphics-x64", "cdda-windows-tiles-x64"],
            linux: ["linux-with-graphics-x64", "cdda-linux-tiles-x64"]
        },
        kind: "stable",
        source: "built-in"
    },
    {
        id: "bn-experimental",
        gameId: "bn",
        channelId: "experimental",
        gameName: "Cataclysm: Bright Nights",
        shortName: "Bright Nights",
        channelName: "Experimental",
        githubOwner: "cataclysmbn",
        githubRepo: "Cataclysm-BN",
        githubBranch: "main",
        releasesUrl: "https://api.github.com/repos/cataclysmbn/Cataclysm-BN/releases",
        assetNameIncludes: {
            windows: ["cbn-windows-tiles-x64"],
            linux: ["cbn-linux-tiles-x64"]
        },
        kind: "experimental",
        source: "built-in"
    },
    {
        id: "bn-stable",
        gameId: "bn",
        channelId: "stable",
        gameName: "Cataclysm: Bright Nights",
        shortName: "Bright Nights",
        channelName: "Stable",
        githubOwner: "cataclysmbn",
        githubRepo: "Cataclysm-BN",
        githubBranch: "main",
        releasesUrl: "https://api.github.com/repos/cataclysmbn/Cataclysm-BN/releases",
        assetNameIncludes: {
            windows: ["cbn-windows-tiles-x64"],
            linux: ["cbn-linux-tiles-x64"]
        },
        kind: "stable",
        source: "built-in"
    },
    {
        id: "tlg-experimental",
        gameId: "tlg",
        channelId: "experimental",
        gameName: "Cataclysm: The Last Generation",
        shortName: "The Last Generation",
        channelName: "Experimental",
        githubOwner: "Cataclysm-TLG",
        githubRepo: "Cataclysm-TLG",
        githubBranch: "master",
        releasesUrl: "https://api.github.com/repos/Cataclysm-TLG/Cataclysm-TLG/releases",
        assetNameIncludes: {
            windows: ["ctlg-windows-tiles-x64"],
            linux: ["ctlg-linux-tiles-x64"]
        },
        kind: "experimental",
        source: "built-in"
    }
];

export function getEffectiveGameChannels(customChannels: GameChannelDefinition[] = []): GameChannelDefinition[] {
    const customIds = new Set(customChannels.map((channel) => channel.id));
    return [...BUILT_IN_GAME_CHANNELS.filter((channel) => !customIds.has(channel.id)), ...customChannels];
}

export function findGameChannel(channels: GameChannelDefinition[], selectedChannelId: string): GameChannelDefinition {
    return channels.find((channel) => channel.id === selectedChannelId) ?? channels.find((channel) => channel.id === DEFAULT_GAME_CHANNEL_ID) ?? channels[0];
}

export function getGameChannelRepositoryUrl(channel: GameChannelDefinition): string {
    const branchPath = channel.githubBranch
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");

    return `https://github.com/${channel.githubOwner}/${channel.githubRepo}/tree/${branchPath}`;
}
