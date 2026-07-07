import { GameChannelDefinition } from "../../shared/game-channel/GameChannelDefinition";
import { normalizeAssetNameIncludes } from "./normalizeAssetNameIncludes";

export function normalizeCustomChannel(channel: unknown): GameChannelDefinition | null {
    if (typeof channel !== "object" || channel === null) {
        return null;
    }

    const candidate = channel as Partial<GameChannelDefinition>;

    if (candidate.source !== "custom" || typeof candidate.id !== "string") {
        return null;
    }

    return {
        id: candidate.id,
        gameId: typeof candidate.gameId === "string" ? candidate.gameId : candidate.id,
        channelId: typeof candidate.channelId === "string" ? candidate.channelId : "custom",
        gameName: typeof candidate.gameName === "string" ? candidate.gameName : candidate.id,
        shortName: typeof candidate.shortName === "string" ? candidate.shortName : candidate.id,
        channelName: typeof candidate.channelName === "string" ? candidate.channelName : "Custom",
        githubOwner: typeof candidate.githubOwner === "string" ? candidate.githubOwner : "",
        githubRepo: typeof candidate.githubRepo === "string" ? candidate.githubRepo : "",
        githubBranch: typeof candidate.githubBranch === "string" && candidate.githubBranch.length > 0 ? candidate.githubBranch : "master",
        releasesUrl: typeof candidate.releasesUrl === "string" ? candidate.releasesUrl : "",
        assetNameIncludes: {
            windows: normalizeAssetNameIncludes(candidate.assetNameIncludes?.windows),
            linux: normalizeAssetNameIncludes(candidate.assetNameIncludes?.linux)
        },
        kind: candidate.kind === "stable" ? "stable" : "experimental",
        source: "custom"
    };
}
