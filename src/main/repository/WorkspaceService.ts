import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { l10n, translate } from "../Localization";
import { parseRepositoryConfig } from "./parseRepositoryConfig";
import { DEFAULT_GAME_CHANNEL_ID, REPOSITORY_CONFIG_FILE_NAME } from "../../shared/Const";
import { RepositoryConfig } from "../../shared/RepositoryConfig";
import { WorkspaceStatus } from "../../shared/workspace/WorkspaceStatus";
import { SettingsIPC } from "../../shared/SettingsIPC";
import { getEffectiveGameChannels } from "../../shared/game-channel/getEffectiveGameChannels";
import { isNodeError } from "../utils/isNodeError";
import { isRepositoryConfig } from "../utils/isRepositoryConfig";
import { areWorkspaceConfigsEqual } from "./areWorkspaceConfigsEqual";
import { configToWorkspaceSettings } from "./configToWorkspaceSettings";
import { DEFAULT_WORKSPACE_SETTINGS } from "./DEFAULT_WORKSPACE_SETTINGS";
import { getDirectoryState } from "../utils/getDirectoryState";
import { normalizeCustomChannel } from "./normalizeCustomChannel";
import { normalizeStringRecord } from "../utils/normalizeStringRecord";
import { isReleaseAssetVariant } from "../../shared/release-asset/isReleaseAssetVariant";
import { DEFAULT_RELEASE_ASSET_VARIANT } from "../../shared/release-asset/DEFAULT_RELEASE_ASSET_VARIANT";
import { DEFAULT_BACKUP_SETTINGS } from "../../shared/backups/DEFAULT_BACKUP_SETTINGS";
import { isAutoBackupLimit } from "../../shared/backups/isAutoBackupLimit";
import { isBackupRotationLimit } from "../../shared/backups/isBackupRotationLimit";
import { isAutoBackupCooldown } from "../../shared/backups/isAutoBackupCooldown";
import { appSettings } from "../settings/AppSettings";

export class WorkspaceService {
    private configIoQueue: Promise<void> = Promise.resolve();
    private readonly workspaceSettingsListeners = new Set<(settings: SettingsIPC) => void>();

    async getWorkspaceStatus(): Promise<WorkspaceStatus> {
        const repositoryPath = appSettings.get("repositoryPath");
        if (!repositoryPath) return { status: "unconfigured" };
        return this.validateWorkspace(repositoryPath);
    }

    async useRepository(repositoryPath: string): Promise<WorkspaceStatus> {
        const status = await this.prepare(repositoryPath);
        if (status.status === "ready") {
            appSettings.set({ repositoryPath });
            l10n.broadcast();
        }
        return status;
    }

    async saveConfig(repositoryPath: string, config: RepositoryConfig): Promise<void> {
        await this.writeConfig(repositoryPath, this.normalizeRepositoryConfig(config));
        this.emitWorkspaceSettingsChanged(configToWorkspaceSettings(this.normalizeRepositoryConfig(config)));
    }

    listenWorkspaceSettings(listener: (settings: SettingsIPC) => void): () => void {
        this.workspaceSettingsListeners.add(listener);
        return () => this.workspaceSettingsListeners.delete(listener);
    }

    async getWorkspaceSettings(): Promise<SettingsIPC> {
        const status = await this.getWorkspaceStatus();
        return status.status === "ready" ? configToWorkspaceSettings(status.config) : DEFAULT_WORKSPACE_SETTINGS;
    }

    async setSelectedChannel(channelId: string): Promise<WorkspaceStatus> {
        const currentStatus = await this.getWorkspaceStatus();
        if (currentStatus.status !== "ready") return currentStatus;
        const channels = getEffectiveGameChannels(currentStatus.config.customGameChannels);
        const selectedChannelId = channels.some((channel) => channel.id === channelId) ? channelId : DEFAULT_GAME_CHANNEL_ID;
        const config = this.normalizeRepositoryConfig({ ...currentStatus.config, selectedChannelId });
        await this.writeConfig(currentStatus.path, config);
        return { status: "ready", path: currentStatus.path, config };
    }

    async updateWorkspaceSettings(patch: Partial<SettingsIPC>): Promise<SettingsIPC> {
        const currentStatus = await this.getWorkspaceStatus();
        if (currentStatus.status !== "ready") throw new Error("Repository is not ready");
        const config = this.normalizeRepositoryConfig({ ...currentStatus.config, ...patch });
        await this.writeConfig(currentStatus.path, config);
        const settings = configToWorkspaceSettings(config);
        this.emitWorkspaceSettingsChanged(settings);
        return settings;
    }

    private emitWorkspaceSettingsChanged(settings: SettingsIPC): void {
        for (const listener of this.workspaceSettingsListeners) {
            listener(settings);
        }
    }

    private async prepare(path: string): Promise<WorkspaceStatus> {
        const directoryState = await getDirectoryState(path);
        if (directoryState.status === "missing") return { status: "invalid", path: path, message: translate("repository.error.selected.missing") };
        if (directoryState.status === "not-directory") return { status: "invalid", path: path, message: translate("repository.error.selected.not.directory") };

        const configPath = join(path, REPOSITORY_CONFIG_FILE_NAME);
        const existingConfig = await this.readConfig(configPath);

        if (existingConfig.status === "ok") {
            const config = this.normalizeRepositoryConfig(existingConfig.config);

            if (!areWorkspaceConfigsEqual(existingConfig.config, config)) {
                await this.writeConfig(path, config);
            }

            const status: WorkspaceStatus = { status: "ready", path: path, config };
            this.emitWorkspaceSettingsChanged(configToWorkspaceSettings(config));
            return status;
        }

        if (!directoryState.isEmpty) {
            return {
                status: "invalid",
                path: path,
                message:
                    existingConfig.status === "missing"
                        ? translate("repository.error.non.empty.without.config", { fileName: REPOSITORY_CONFIG_FILE_NAME })
                        : translate("repository.error.invalid.existing.config", { fileName: REPOSITORY_CONFIG_FILE_NAME })
            };
        }

        const config: RepositoryConfig = this.normalizeRepositoryConfig({
            selectedChannelId: DEFAULT_GAME_CHANNEL_ID,
            customGameChannels: [],
            activeGameBundleByChannel: {}
        });

        await this.writeConfig(path, config);
        const status: WorkspaceStatus = { status: "ready", path: path, config };
        this.emitWorkspaceSettingsChanged(configToWorkspaceSettings(config));
        return status;
    }

    private normalizeRepositoryConfig(config: Partial<RepositoryConfig>): RepositoryConfig {
        const customChannels = Array.isArray(config.customGameChannels) ? config.customGameChannels.map(normalizeCustomChannel).filter((channel) => channel !== null) : [];
        const channels = getEffectiveGameChannels(customChannels);
        const selectedChannelId = typeof config.selectedChannelId === "string" && channels.some((channel) => channel.id === config.selectedChannelId) ? config.selectedChannelId : DEFAULT_GAME_CHANNEL_ID;

        return {
            schemaVersion: 1,
            selectedChannelId,
            customGameChannels: customChannels,
            activeGameBundleByChannel: normalizeStringRecord(config.activeGameBundleByChannel),
            releaseAssetVariant: isReleaseAssetVariant(config.releaseAssetVariant) ? config.releaseAssetVariant : DEFAULT_RELEASE_ASSET_VARIANT,
            backupsEnabled: typeof config.backupsEnabled === "boolean" ? config.backupsEnabled : DEFAULT_BACKUP_SETTINGS.backupsEnabled,
            autoBackupLimit: isAutoBackupLimit(config.autoBackupLimit) ? config.autoBackupLimit : DEFAULT_BACKUP_SETTINGS.autoBackupLimit,
            manualBackupRotationLimit: isBackupRotationLimit(config.manualBackupRotationLimit) ? config.manualBackupRotationLimit : DEFAULT_BACKUP_SETTINGS.manualBackupRotationLimit,
            autoBackupCooldown: isAutoBackupCooldown(config.autoBackupCooldown) ? config.autoBackupCooldown : DEFAULT_BACKUP_SETTINGS.autoBackupCooldown
        };
    }

    private async validateWorkspace(path: string): Promise<WorkspaceStatus> {
        const directoryState = await getDirectoryState(path);
        if (directoryState.status === "missing") return { status: "invalid", path: path, message: translate("repository.error.saved.missing") };
        if (directoryState.status === "not-directory") return { status: "invalid", path: path, message: translate("repository.error.saved.not.directory") };

        const config = await this.readConfig(join(path, REPOSITORY_CONFIG_FILE_NAME));
        if (config.status === "ok") {
            const normalizedConfig = this.normalizeRepositoryConfig(config.config);
            if (!areWorkspaceConfigsEqual(config.config, normalizedConfig)) await this.writeConfig(path, normalizedConfig);
            return { status: "ready", path: path, config: normalizedConfig };
        }

        return {
            status: "invalid",
            path: path,
            message:
                config.status === "missing"
                    ? translate("repository.error.saved.without.config", { fileName: REPOSITORY_CONFIG_FILE_NAME })
                    : translate("repository.error.saved.invalid.config", { fileName: REPOSITORY_CONFIG_FILE_NAME })
        };
    }

    private async readConfig(configPath: string): Promise<{ status: "ok"; config: RepositoryConfig } | { status: "missing" } | { status: "invalid" }> {
        return this.withConfigIo(async () => {
            try {
                const content = await readFile(configPath, "utf8");
                const parsed = parseRepositoryConfig(content, configPath);
                if (!isRepositoryConfig(parsed)) return { status: "invalid" };
                return { status: "ok", config: parsed };
            } catch (error) {
                if (isNodeError(error) && error.code === "ENOENT") return { status: "missing" };
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
