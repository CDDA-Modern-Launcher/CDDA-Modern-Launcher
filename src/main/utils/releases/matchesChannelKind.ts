import { GithubRelease } from "../../../shared/GithubRelease";
import { GameChannelDefinition } from "../../../shared/game-channel/GameChannelDefinition";

export function matchesChannelKind(release: GithubRelease, channel: GameChannelDefinition): boolean {
    const value = `${release.id} ${release.name}`.toLowerCase();
    const isExperimentalRelease = value.includes("experimental");
    return channel.kind === "experimental" ? isExperimentalRelease : !isExperimentalRelease;
}
