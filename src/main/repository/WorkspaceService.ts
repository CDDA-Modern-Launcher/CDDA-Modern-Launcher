import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { LocalizationService } from "../localization/LocalizationService";
import { AppSettings } from "../settings/AppSettings";
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
import { normalizeRepositoryConfig } from "./normalizeRepositoryConfig";
import { getDirectoryState } from "../utils/getDirectoryState";

export class WorkspaceService {
    private configIoQueue: Promise<void> = Promise.resolve();
    private readonly workspaceSettingsListeners = new Set<(settings: SettingsIPC) => void>();

    constructor(
        private readonly appSettings: AppSettings,
        private readonly localizationService: LocalizationService
    ) {}

    async getWorkspaceStatus(): Promise<WorkspaceStatus> {
        const repositoryPath = await this.appSettings.getRepositoryPath();
        if (repositoryPath === null) return { status: "unconfigured" };
        return this.validateWorkspace(repositoryPath);
    }

    async useRepository(path: string): Promise<WorkspaceStatus> {
        const status = await this.prepare(path);
        if (status.status === "ready") {
            await this.appSettings.setRepositoryPath(path);
            this.localizationService.broadcast();
        }
        return status;
    }

    async saveConfig(repositoryPath: string, config: RepositoryConfig): Promise<void> {
        await this.writeConfig(repositoryPath, normalizeRepositoryConfig(config));
        this.emitWorkspaceSettingsChanged(configToWorkspaceSettings(normalizeRepositoryConfig(config)));
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
        const config = normalizeRepositoryConfig({ ...currentStatus.config, selectedChannelId });
        await this.writeConfig(currentStatus.path, config);
        return { status: "ready", path: currentStatus.path, config };
    }

    async updateWorkspaceSettings(patch: Partial<SettingsIPC>): Promise<SettingsIPC> {
        const currentStatus = await this.getWorkspaceStatus();
        if (currentStatus.status !== "ready") throw new Error("Repository is not ready");
        const config = normalizeRepositoryConfig({ ...currentStatus.config, ...patch });
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
        if (directoryState.status === "missing") return { status: "invalid", path: path, message: this.localizationService.t("repository.error.selectedMissing") };
        if (directoryState.status === "not-directory") return { status: "invalid", path: path, message: this.localizationService.t("repository.error.selectedNotDirectory") };

        const configPath = join(path, REPOSITORY_CONFIG_FILE_NAME);
        const existingConfig = await this.readConfig(configPath);

        if (existingConfig.status === "ok") {
            const config = normalizeRepositoryConfig(existingConfig.config);

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
                        ? this.localizationService.t("repository.error.nonEmptyWithoutConfig", { fileName: REPOSITORY_CONFIG_FILE_NAME })
                        : this.localizationService.t("repository.error.invalidExistingConfig", { fileName: REPOSITORY_CONFIG_FILE_NAME })
            };
        }

        const config: RepositoryConfig = normalizeRepositoryConfig({
            selectedChannelId: DEFAULT_GAME_CHANNEL_ID,
            customGameChannels: [],
            activeGameBundleByChannel: {}
        });

        await this.writeConfig(path, config);
        const status: WorkspaceStatus = { status: "ready", path: path, config };
        this.emitWorkspaceSettingsChanged(configToWorkspaceSettings(config));
        return status;
    }

    private async validateWorkspace(path: string): Promise<WorkspaceStatus> {
        const directoryState = await getDirectoryState(path);
        if (directoryState.status === "missing") return { status: "invalid", path: path, message: this.localizationService.t("repository.error.savedMissing") };
        if (directoryState.status === "not-directory") return { status: "invalid", path: path, message: this.localizationService.t("repository.error.savedNotDirectory") };

        const config = await this.readConfig(join(path, REPOSITORY_CONFIG_FILE_NAME));
        if (config.status === "ok") {
            const normalizedConfig = normalizeRepositoryConfig(config.config);
            if (!areWorkspaceConfigsEqual(config.config, normalizedConfig)) await this.writeConfig(path, normalizedConfig);
            return { status: "ready", path: path, config: normalizedConfig };
        }

        return {
            status: "invalid",
            path: path,
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
