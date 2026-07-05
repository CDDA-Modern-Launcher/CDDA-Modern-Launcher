import { GameChannelDefinition } from "./GameChannelDefinition";

export function getGameChannelRepositoryUrl(channel: GameChannelDefinition): string {
    const branchPath = channel.githubBranch
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");

    return `https://github.com/${channel.githubOwner}/${channel.githubRepo}/tree/${branchPath}`;
}
