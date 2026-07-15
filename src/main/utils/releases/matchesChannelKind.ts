import { GithubRelease } from "../../../shared/GithubRelease";
import { GameChannelDefinition } from "../../../shared/game-channel/GameChannelDefinition";

export function matchesChannelKind(release: GithubRelease, channel: GameChannelDefinition): boolean {
    const value = `${release.id} ${release.name}`.toLowerCase();
    const isExperimentalRelease = release.prerelease || value.includes("experimental") || value.includes("nightly");
    return channel.kind === "experimental" ? isExperimentalRelease : !isExperimentalRelease;
}
