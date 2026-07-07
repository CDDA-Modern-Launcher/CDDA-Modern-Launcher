import { join } from "node:path";

export function getChannelModRepositoryPath(repositoryPath: string, channelId: string): string {
    return join(repositoryPath, "mod-repository", channelId);
}

export function getChannelModsPath(repositoryPath: string, channelId: string): string {
    return join(getChannelModRepositoryPath(repositoryPath, channelId), "mods");
}

export function getChannelModTempPath(repositoryPath: string, channelId: string): string {
    return join(getChannelModRepositoryPath(repositoryPath, channelId), ".tmp");
}

export function getModPath(repositoryPath: string, channelId: string, safeModId: string): string {
    return join(getChannelModsPath(repositoryPath, channelId), safeModId);
}
