import type { GameChannelDefinition } from "./gameChannels";

export const REPOSITORY_CONFIG_FILE_NAME = "cdda.launcher.config.jsonc";

export type RepositoryConfig = {
    schemaVersion: 1;
    createdAt: string;
    selectedChannelId: string;
    customChannels: GameChannelDefinition[];
};

export type RepositoryStatus = { status: "unconfigured" } | { status: "loading"; path: string } | { status: "ready"; path: string; config: RepositoryConfig } | { status: "invalid"; path: string; message: string };

export type SelectRepositoryResult = { status: "cancelled" } | { status: "selected"; repository: RepositoryStatus };

export type SetRepositoryChannelResult = { status: "updated"; repository: RepositoryStatus } | { status: "unavailable"; message: string };
