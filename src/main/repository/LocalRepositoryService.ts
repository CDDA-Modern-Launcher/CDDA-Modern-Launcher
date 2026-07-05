import { constants } from "node:fs";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { DEFAULT_GAME_CHANNEL_ID, GameChannelDefinition, getEffectiveGameChannels } from "../../shared/gameChannels";
import { REPOSITORY_CONFIG_FILE_NAME, RepositoryConfig, RepositoryStatus } from "../../shared/repository";
import { LocalizationService } from "../localization/LocalizationService";
import { LauncherSettingsStore } from "../settings/LauncherSettingsStore";
import { parseRepositoryConfig } from "./parseRepositoryConfig";

export class LocalRepositoryService {
    constructor(
        private readonly settingsStore: LauncherSettingsStore,
        private readonly localizationService: LocalizationService
    ) {}

    async getInitialStatus(): Promise<RepositoryStatus> {
        const repositoryPath = await this.settingsStore.getRepositoryPath();

        if (repositoryPath === null) {
            return { status: "unconfigured" };
        }

        return this.validate(repositoryPath);
    }

    async useRepository(repositoryPath: string): Promise<RepositoryStatus> {
        const status = await this.prepare(repositoryPath);

        if (status.status === "ready") {
            await this.settingsStore.setRepositoryPath(repositoryPath);
            await this.localizationService.setRepositoryPath(repositoryPath);
        }

        return status;
    }

    async saveConfig(repositoryPath: string, config: RepositoryConfig): Promise<void> {
        await this.writeConfig(repositoryPath, normalizeRepositoryConfig(config));
    }

    async setSelectedChannel(channelId: string): Promise<RepositoryStatus> {
        const currentStatus = await this.getInitialStatus();

        if (currentStatus.status !== "ready") {
            return currentStatus;
        }

        const channels = getEffectiveGameChannels(currentStatus.config.customChannels);
        const selectedChannelId = channels.some((channel) => channel.id === channelId) ? channelId : DEFAULT_GAME_CHANNEL_ID;
        const config = normalizeRepositoryConfig({ ...currentStatus.config, selectedChannelId });

        await this.writeConfig(currentStatus.path, config);
        return { status: "ready", path: currentStatus.path, config };
    }

    private async prepare(repositoryPath: string): Promise<RepositoryStatus> {
        const directoryState = await getDirectoryState(repositoryPath);

        if (directoryState.status === "missing") {
            return { status: "invalid", path: repositoryPath, message: this.localizationService.t("repository.error.selectedMissing") };
        }

        if (directoryState.status === "not-directory") {
            return { status: "invalid", path: repositoryPath, message: this.localizationService.t("repository.error.selectedNotDirectory") };
        }

        const configPath = join(repositoryPath, REPOSITORY_CONFIG_FILE_NAME);
        const existingConfig = await this.readConfig(configPath);

        if (existingConfig.status === "ok") {
            const config = normalizeRepositoryConfig(existingConfig.config);
            await this.writeConfig(repositoryPath, config);
            return { status: "ready", path: repositoryPath, config };
        }

        if (!directoryState.isEmpty) {
            return {
                status: "invalid",
                path: repositoryPath,
                message:
                    existingConfig.status === "missing"
                        ? this.localizationService.t("repository.error.nonEmptyWithoutConfig", { fileName: REPOSITORY_CONFIG_FILE_NAME })
                        : this.localizationService.t("repository.error.invalidExistingConfig", { fileName: REPOSITORY_CONFIG_FILE_NAME })
            };
        }

        const config: RepositoryConfig = normalizeRepositoryConfig({
            schemaVersion: 1,
            createdAt: new Date().toISOString(),
            selectedChannelId: DEFAULT_GAME_CHANNEL_ID,
            customChannels: [],
            activeInstallByChannel: {},
            lastSeenReleaseByChannel: {}
        });

        await this.writeConfig(repositoryPath, config);
        return { status: "ready", path: repositoryPath, config };
    }

    private async validate(repositoryPath: string): Promise<RepositoryStatus> {
        const directoryState = await getDirectoryState(repositoryPath);

        if (directoryState.status === "missing") {
            return {
                status: "invalid",
                path: repositoryPath,
                message: this.localizationService.t("repository.error.savedMissing")
            };
        }

        if (directoryState.status === "not-directory") {
            return {
                status: "invalid",
                path: repositoryPath,
                message: this.localizationService.t("repository.error.savedNotDirectory")
            };
        }

        const config = await this.readConfig(join(repositoryPath, REPOSITORY_CONFIG_FILE_NAME));

        if (config.status === "ok") {
            const normalizedConfig = normalizeRepositoryConfig(config.config);
            await this.writeConfig(repositoryPath, normalizedConfig);
            return { status: "ready", path: repositoryPath, config: normalizedConfig };
        }

        return {
            status: "invalid",
            path: repositoryPath,
            message:
                config.status === "missing"
                    ? this.localizationService.t("repository.error.savedWithoutConfig", { fileName: REPOSITORY_CONFIG_FILE_NAME })
                    : this.localizationService.t("repository.error.savedInvalidConfig", { fileName: REPOSITORY_CONFIG_FILE_NAME })
        };
    }

    private async readConfig(configPath: string): Promise<{ status: "ok"; config: RepositoryConfig } | { status: "missing" } | { status: "invalid" }> {
        try {
            const content = await readFile(configPath, "utf8");
            const parsed = parseRepositoryConfig(content, configPath);

            if (!isRepositoryConfig(parsed)) {
                return { status: "invalid" };
            }

            return { status: "ok", config: parsed };
        } catch (error) {
            if (isNodeError(error) && error.code === "ENOENT") {
                return { status: "missing" };
            }

            console.error("[repository] failed to read repository config", error);
            return { status: "invalid" };
        }
    }

    private async writeConfig(repositoryPath: string, config: RepositoryConfig): Promise<void> {
        await writeFile(join(repositoryPath, REPOSITORY_CONFIG_FILE_NAME), `${JSON.stringify(config, null, 2)}\n`, "utf8");
    }
}

type DirectoryState = { status: "ok"; isEmpty: boolean } | { status: "missing" } | { status: "not-directory" };

async function getDirectoryState(path: string): Promise<DirectoryState> {
    try {
        await access(path, constants.F_OK);
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") {
            return { status: "missing" };
        }

        throw error;
    }

    try {
        await mkdir(path, { recursive: false });
    } catch (error) {
        if (isNodeError(error) && error.code === "EEXIST") {
            // The path exists. readdir below is the portable directory check.
        } else {
            throw error;
        }
    }

    try {
        const entries = await readdir(path);
        return { status: "ok", isEmpty: entries.length === 0 };
    } catch (error) {
        if (isNodeError(error) && (error.code === "ENOTDIR" || error.code === "EINVAL")) {
            return { status: "not-directory" };
        }

        throw error;
    }
}

function normalizeRepositoryConfig(config: RepositoryConfig): RepositoryConfig {
    const customChannels = Array.isArray(config.customChannels) ? config.customChannels.map(normalizeCustomChannel).filter((channel) => channel !== null) : [];
    const channels = getEffectiveGameChannels(customChannels);
    const selectedChannelId = channels.some((channel) => channel.id === config.selectedChannelId) ? config.selectedChannelId : DEFAULT_GAME_CHANNEL_ID;

    return {
        schemaVersion: 1,
        createdAt: config.createdAt,
        selectedChannelId,
        customChannels,
        activeInstallByChannel: normalizeStringRecord(config.activeInstallByChannel),
        lastSeenReleaseByChannel: normalizeStringRecord(config.lastSeenReleaseByChannel)
    };
}

function normalizeCustomChannel(channel: unknown): GameChannelDefinition | null {
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

function normalizeAssetNameIncludes(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
    return typeof value === "string" && value.length > 0 ? [value] : [];
}

function isRepositoryConfig(value: unknown): value is RepositoryConfig {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidate = value as Partial<RepositoryConfig>;
    return (
        candidate.schemaVersion === 1 &&
        typeof candidate.createdAt === "string" &&
        (candidate.selectedChannelId === undefined || typeof candidate.selectedChannelId === "string") &&
        (candidate.customChannels === undefined || Array.isArray(candidate.customChannels))
    );
}

function normalizeStringRecord(value: unknown): Record<string, string> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return {};
    }

    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error;
}
