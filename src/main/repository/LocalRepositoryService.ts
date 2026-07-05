import { constants } from "node:fs";
import { access, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { LocalizationService } from "../localization/LocalizationService";
import { LauncherSettingsStore } from "../settings/LauncherSettingsStore";
import { parseRepositoryConfig } from "./parseRepositoryConfig";
import { DEFAULT_GAME_CHANNEL_ID, REPOSITORY_CONFIG_FILE_NAME } from "../../shared/Const";
import { RepositoryConfig } from "../../shared/RepositoryConfig";
import { WorkspaceStatus } from "../../shared/workspace/WorkspaceStatus";
import { TBackupRotationLimit } from "../../shared/backups/types/TBackupRotationLimit";
import { TAutoBackupLimit } from "../../shared/backups/types/TAutoBackupLimit";
import { TAutoBackupCooldown } from "../../shared/backups/types/TAutoBackupCooldown";
import { DEFAULT_BACKUP_SETTINGS } from "../../shared/backups/DEFAULT_BACKUP_SETTINGS";
import { isAutoBackupLimit } from "../../shared/backups/isAutoBackupLimit";
import { isBackupRotationLimit } from "../../shared/backups/isBackupRotationLimit";
import { isAutoBackupCooldown } from "../../shared/backups/isAutoBackupCooldown";
import { TReleaseAssetVariant } from "../../shared/release-asset/TReleaseAssetVariant";
import { DEFAULT_RELEASE_ASSET_VARIANT } from "../../shared/release-asset/DEFAULT_RELEASE_ASSET_VARIANT";
import { SettingsIPC } from "../../shared/SettingsIPC";
import { isReleaseAssetVariant } from "../../shared/release-asset/isReleaseAssetVariant";
import { GameChannelDefinition } from "../../shared/game-channel/GameChannelDefinition";
import { getEffectiveGameChannels } from "../../shared/game-channel/getEffectiveGameChannels";

export class LocalRepositoryService {
    private configIoQueue: Promise<void> = Promise.resolve();
    private readonly userSettingsListeners = new Set<(settings: SettingsIPC) => void>();

    constructor(
        private readonly settingsStore: LauncherSettingsStore,
        private readonly localizationService: LocalizationService
    ) {}

    async getInitialStatus(): Promise<WorkspaceStatus> {
        const repositoryPath = await this.settingsStore.getRepositoryPath();

        if (repositoryPath === null) {
            return { status: "unconfigured" };
        }

        return this.validate(repositoryPath);
    }

    async useRepository(repositoryPath: string): Promise<WorkspaceStatus> {
        const status = await this.prepare(repositoryPath);

        if (status.status === "ready") {
            await this.settingsStore.setRepositoryPath(repositoryPath);
            await this.localizationService.setRepositoryPath(repositoryPath);
        }

        return status;
    }

    async saveConfig(repositoryPath: string, config: RepositoryConfig): Promise<void> {
        await this.writeConfig(repositoryPath, normalizeRepositoryConfig(config));
        this.emitUserSettingsChanged(configToUserSettings(normalizeRepositoryConfig(config)));
    }

    onUserSettingsChanged(listener: (settings: SettingsIPC) => void): () => void {
        this.userSettingsListeners.add(listener);
        return () => this.userSettingsListeners.delete(listener);
    }

    async getUserSettings(): Promise<SettingsIPC> {
        const status = await this.getInitialStatus();
        return status.status === "ready" ? configToUserSettings(status.config) : DEFAULT_REPOSITORY_USER_SETTINGS;
    }

    async setGameAssetVariant(gameAssetVariant: TReleaseAssetVariant): Promise<SettingsIPC> {
        return this.updateUserSettings({ releaseAssetVariant: gameAssetVariant });
    }

    async setBackupsEnabled(backupsEnabled: boolean): Promise<SettingsIPC> {
        return this.updateUserSettings({ backupsEnabled });
    }

    async setAutoBackupLimit(autoBackupLimit: TAutoBackupLimit): Promise<SettingsIPC> {
        return this.updateUserSettings({ autoBackupLimit });
    }

    async setAutoBackupCooldown(autoBackupCooldown: TAutoBackupCooldown): Promise<SettingsIPC> {
        return this.updateUserSettings({ autoBackupCooldown });
    }

    async setManualBackupRotationLimit(manualBackupRotationLimit: TBackupRotationLimit): Promise<SettingsIPC> {
        return this.updateUserSettings({ manualBackupRotationLimit });
    }

    async setSelectedChannel(channelId: string): Promise<WorkspaceStatus> {
        const currentStatus = await this.getInitialStatus();

        if (currentStatus.status !== "ready") {
            return currentStatus;
        }

        const channels = getEffectiveGameChannels(currentStatus.config.customGameChannels);
        const selectedChannelId = channels.some((channel) => channel.id === channelId) ? channelId : DEFAULT_GAME_CHANNEL_ID;
        const config = normalizeRepositoryConfig({ ...currentStatus.config, selectedChannelId });

        await this.writeConfig(currentStatus.path, config);
        return { status: "ready", path: currentStatus.path, config };
    }

    private async updateUserSettings(patch: Partial<SettingsIPC>): Promise<SettingsIPC> {
        const currentStatus = await this.getInitialStatus();

        if (currentStatus.status !== "ready") {
            throw new Error("Repository is not ready");
        }

        const config = normalizeRepositoryConfig({ ...currentStatus.config, ...patch });
        await this.writeConfig(currentStatus.path, config);
        const settings = configToUserSettings(config);
        this.emitUserSettingsChanged(settings);
        return settings;
    }

    private emitUserSettingsChanged(settings: SettingsIPC): void {
        for (const listener of this.userSettingsListeners) {
            listener(settings);
        }
    }

    private async prepare(repositoryPath: string): Promise<WorkspaceStatus> {
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

            if (!areRepositoryConfigsEqual(existingConfig.config, config)) {
                await this.writeConfig(repositoryPath, config);
            }

            const status: WorkspaceStatus = { status: "ready", path: repositoryPath, config };
            this.emitUserSettingsChanged(configToUserSettings(config));
            return status;
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
            customGameChannels: [],
            activeInstallByChannel: {},
            lastSeenReleaseByChannel: {}
        });

        await this.writeConfig(repositoryPath, config);
        const status: WorkspaceStatus = { status: "ready", path: repositoryPath, config };
        this.emitUserSettingsChanged(configToUserSettings(config));
        return status;
    }

    private async validate(repositoryPath: string): Promise<WorkspaceStatus> {
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

            if (!areRepositoryConfigsEqual(config.config, normalizedConfig)) {
                await this.writeConfig(repositoryPath, normalizedConfig);
            }

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
        return this.withConfigIo(async () => {
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
        });
    }

    private async writeConfig(repositoryPath: string, config: RepositoryConfig): Promise<void> {
        await this.withConfigIo(async () => {
            const configPath = join(repositoryPath, REPOSITORY_CONFIG_FILE_NAME);
            const tempPath = join(repositoryPath, `${REPOSITORY_CONFIG_FILE_NAME}.${process.pid}.${Date.now()}.tmp`);

            try {
                await writeFile(tempPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
                await rename(tempPath, configPath);
            } finally {
                await rm(tempPath, { force: true });
            }
        });
    }

    private withConfigIo<T>(operation: () => Promise<T>): Promise<T> {
        const run = this.configIoQueue.then(operation, operation);
        this.configIoQueue = run.then(
            () => undefined,
            () => undefined
        );
        return run;
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

function normalizeRepositoryConfig(config: Partial<RepositoryConfig>): RepositoryConfig {
    const customChannels = Array.isArray(config.customGameChannels) ? config.customGameChannels.map(normalizeCustomChannel).filter((channel) => channel !== null) : [];
    const channels = getEffectiveGameChannels(customChannels);
    const selectedChannelId = typeof config.selectedChannelId === "string" && channels.some((channel) => channel.id === config.selectedChannelId) ? config.selectedChannelId : DEFAULT_GAME_CHANNEL_ID;

    return {
        schemaVersion: 1,
        createdAt: typeof config.createdAt === "string" ? config.createdAt : new Date().toISOString(),
        selectedChannelId,
        customGameChannels: customChannels,
        activeInstallByChannel: normalizeStringRecord(config.activeInstallByChannel),
        lastSeenReleaseByChannel: normalizeStringRecord(config.lastSeenReleaseByChannel),
        releaseAssetVeriant: isReleaseAssetVariant(config.releaseAssetVeriant) ? config.releaseAssetVeriant : DEFAULT_RELEASE_ASSET_VARIANT,
        backupsEnabled: typeof config.backupsEnabled === "boolean" ? config.backupsEnabled : DEFAULT_BACKUP_SETTINGS.backupsEnabled,
        autoBackupLimit: isAutoBackupLimit(config.autoBackupLimit) ? config.autoBackupLimit : DEFAULT_BACKUP_SETTINGS.autoBackupLimit,
        manualBackupRotationLimit: isBackupRotationLimit(config.manualBackupRotationLimit) ? config.manualBackupRotationLimit : DEFAULT_BACKUP_SETTINGS.manualBackupRotationLimit,
        autoBackupCooldown: isAutoBackupCooldown(config.autoBackupCooldown) ? config.autoBackupCooldown : DEFAULT_BACKUP_SETTINGS.autoBackupCooldown
    };
}

const DEFAULT_REPOSITORY_USER_SETTINGS: SettingsIPC = {
    releaseAssetVariant: DEFAULT_RELEASE_ASSET_VARIANT,
    backupsEnabled: DEFAULT_BACKUP_SETTINGS.backupsEnabled,
    autoBackupLimit: DEFAULT_BACKUP_SETTINGS.autoBackupLimit,
    manualBackupRotationLimit: DEFAULT_BACKUP_SETTINGS.manualBackupRotationLimit,
    autoBackupCooldown: DEFAULT_BACKUP_SETTINGS.autoBackupCooldown
};

function configToUserSettings(config: RepositoryConfig): SettingsIPC {
    return {
        releaseAssetVariant: config.releaseAssetVeriant,
        backupsEnabled: config.backupsEnabled,
        autoBackupLimit: config.autoBackupLimit,
        manualBackupRotationLimit: config.manualBackupRotationLimit,
        autoBackupCooldown: config.autoBackupCooldown
    };
}

function areRepositoryConfigsEqual(left: RepositoryConfig, right: RepositoryConfig): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
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
        (candidate.customGameChannels === undefined || Array.isArray(candidate.customGameChannels))
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
