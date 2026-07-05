import { join } from "node:path";


import { MOD_REPOSITORY_DIRECTORY_NAME } from "../../shared/Const";

export function getChannelModRepositoryPath(repositoryPath: string, channelId: string): string {
    return join(repositoryPath, MOD_REPOSITORY_DIRECTORY_NAME, channelId);
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
