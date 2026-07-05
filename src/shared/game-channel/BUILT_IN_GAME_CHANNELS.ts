import { GameChannelDefinition } from "./GameChannelDefinition";

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
            windows: ["windows-with-graphics-and-sounds-x64", "windows-with-graphics-x64", "cdda-windows-tiles-x64"],
            linux: ["linux-with-graphics-and-sounds-x64", "linux-with-graphics-x64", "cdda-linux-tiles-x64"]
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
            windows: ["windows-with-graphics-and-sounds-x64", "windows-with-graphics-x64", "cdda-windows-tiles-x64"],
            linux: ["linux-with-graphics-and-sounds-x64", "linux-with-graphics-x64", "cdda-linux-tiles-x64"]
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
            // todo: update this, currently using old asset names
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
            // todo: update this, currently using old asset names
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
            // todo: update this, currently using old asset names
            windows: ["ctlg-windows-tiles-x64"],
            linux: ["ctlg-linux-tiles-x64"]
        },
        kind: "experimental",
        source: "built-in"
    }
];
