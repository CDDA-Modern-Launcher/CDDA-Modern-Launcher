import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { BrowserWindow, dialog, ipcMain } from "electron";
import { join } from "node:path";

import { translate } from "./LocalizationService";
import { DEFAULT_GAME_CHANNEL_ID, WORKSPACE_CONFIG_FILE_NAME } from "../shared/Const";
import { WorkspaceConfig } from "../shared/WorkspaceConfig";
import { ReadyWorkspaceStatus, WorkspaceStatus } from "../shared/workspace/WorkspaceStatus";
import { SettingsIPC } from "../shared/SettingsIPC";
import { BUILT_IN_GAME_CHANNELS } from "../shared/game-channel/BUILT_IN_GAME_CHANNELS";
import { GameChannelDefinition } from "../shared/game-channel/GameChannelDefinition";
import { isNodeError } from "./utils/isNodeError";
import { getDirectoryState } from "./utils/getDirectoryState";
import { normalizeStringRecord } from "./utils/normalizeStringRecord";
import { DEFAULT_RELEASE_ASSET_VARIANT } from "../shared/release-asset/DEFAULT_RELEASE_ASSET_VARIANT";
import { DEFAULT_BACKUP_SETTINGS } from "../shared/backups/DEFAULT_BACKUP_SETTINGS";
import { appSettings } from "./settings/AppSettings";
import { Bridge } from "../shared/bridge-api/Bridge";
import { EWorkspaceSelectResult } from "../shared/workspace/EWorkspaceSelectResult";
import { TBackupRotationLimit } from "../shared/backups/types/TBackupRotationLimit";
import { TAutoBackupLimit } from "../shared/backups/types/TAutoBackupLimit";
import { TAutoBackupCooldown } from "../shared/backups/types/TAutoBackupCooldown";
import { TReleaseAssetVariant } from "../shared/release-asset/TReleaseAssetVariant";
import { parse, ParseError, printParseErrorCode } from "jsonc-parser";
import { publishGameState, synchronizeActiveBundle } from "./game/GameStateEvents";
import { broadcastIPC } from "./utils/broadcastIPC";

const DEFAULT_WORKSPACE_SETTINGS: SettingsIPC = {
    releaseAssetVariant: DEFAULT_RELEASE_ASSET_VARIANT,
    backupsEnabled: DEFAULT_BACKUP_SETTINGS.backupsEnabled,
    autoBackupLimit: DEFAULT_BACKUP_SETTINGS.autoBackupLimit,
    manualBackupRotationLimit: DEFAULT_BACKUP_SETTINGS.manualBackupRotationLimit,
    autoBackupCooldown: DEFAULT_BACKUP_SETTINGS.autoBackupCooldown
};

class WorkspaceService {
    private configIoQueue: Promise<void> = Promise.resolve();
    private workspaceStatus: WorkspaceStatus = { status: "unconfigured" };

    async initialize(): Promise<void> {
        const workspacePath = appSettings.get("workspacePath");
        this.workspaceStatus = workspacePath ? await this.validateWorkspace(workspacePath) : { status: "unconfigured" };

        ipcMain.handle(Bridge.Workspace.getStatus, () => this.getWorkspaceStatus());
        ipcMain.handle(Bridge.Workspace.clear, () => this.clearWorkspace());
        ipcMain.handle(Bridge.Workspace.setChannel, (_event, channelId: string) => this.setSelectedChannel(channelId));
        ipcMain.handle(Bridge.Workspace.selectNewFolder, async (event): Promise<EWorkspaceSelectResult> => {
            const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined;
            const options = { title: translate("repository.dialog.select.folder.title"), properties: ["openDirectory", "createDirectory"] as Array<"openDirectory" | "createDirectory"> };
            const result = owner === undefined ? await dialog.showOpenDialog(options) : await dialog.showOpenDialog(owner, options);
            if (result.canceled || result.filePaths.length === 0) return { status: "cancelled" };
            return { status: "selected", workspace: await this.setWorkspacePath(result.filePaths[0]) };
        });

        ipcMain.handle(Bridge.Settings.get, () => this.getWorkspaceSettings());
        ipcMain.handle(Bridge.Settings.setReleaseAssetVariant, async (_, releaseAssetVariant: TReleaseAssetVariant): Promise<SettingsIPC> => this.updateWorkspaceSettings({ releaseAssetVariant }));
        ipcMain.handle(Bridge.Settings.setBackupsEnabled, (_, backupsEnabled: boolean) => this.updateWorkspaceSettings({ backupsEnabled }));
        ipcMain.handle(Bridge.Settings.setAutoBackupLimit, async (_, autoBackupLimit: TAutoBackupLimit): Promise<SettingsIPC> => this.updateWorkspaceSettings({ autoBackupLimit }));
        ipcMain.handle(Bridge.Settings.setAutoBackupCooldown, async (_, autoBackupCooldown: TAutoBackupCooldown): Promise<SettingsIPC> => this.updateWorkspaceSettings({ autoBackupCooldown }));
        ipcMain.handle(Bridge.Settings.setBackupRotationLimit, async (_, manualBackupRotationLimit: TBackupRotationLimit): Promise<SettingsIPC> => this.updateWorkspaceSettings({ manualBackupRotationLimit }));
    }

    getWorkspaceStatus(): WorkspaceStatus {
        return this.workspaceStatus;
    }

    getReadyWorkspace(): ReadyWorkspaceStatus | null {
        return this.workspaceStatus.status === "ready" ? this.workspaceStatus : null;
    }

    async setWorkspacePath(workspacePath: string): Promise<WorkspaceStatus> {
        const status = await this.prepare(workspacePath);
        this.workspaceStatus = status;
        if (status.status === "ready") appSettings.set({ workspacePath });
        await synchronizeActiveBundle();
        await publishGameState();
        return status;
    }

    async clearWorkspace(): Promise<WorkspaceStatus> {
        this.workspaceStatus = { status: "unconfigured" };
        appSettings.set({ workspacePath: "" });
        await appSettings.flush();
        broadcastIPC(Bridge.Settings.changed, DEFAULT_WORKSPACE_SETTINGS);
        await synchronizeActiveBundle();
        await publishGameState();
        return this.workspaceStatus;
    }

    async saveConfig(config: WorkspaceConfig): Promise<ReadyWorkspaceStatus> {
        const workspace = this.requireReadyWorkspace();
        const normalizedConfig = this.normalizeConfig(config);
        await this.writeConfig(workspace.path, normalizedConfig);
        return this.applyReadyWorkspace(workspace.path, normalizedConfig);
    }

    getWorkspaceSettings(): SettingsIPC {
        const workspace = this.getReadyWorkspace();
        return workspace === null ? DEFAULT_WORKSPACE_SETTINGS : configToWorkspaceSettings(workspace.config);
    }

    async setSelectedChannel(channelId: string): Promise<WorkspaceStatus> {
        const workspace = this.getReadyWorkspace();
        if (workspace === null) return this.workspaceStatus;
        const selectedChannelId = workspace.gameChannels.some((channel) => channel.id === channelId) ? channelId : DEFAULT_GAME_CHANNEL_ID;
        const status = await this.saveConfig({ ...workspace.config, selectedChannelId });
        await synchronizeActiveBundle();
        await publishGameState();
        return status;
    }

    async updateWorkspaceSettings(patch: Partial<SettingsIPC>): Promise<SettingsIPC> {
        const workspace = this.requireReadyWorkspace();
        const updatedWorkspace = await this.saveConfig({ ...workspace.config, ...patch });
        return configToWorkspaceSettings(updatedWorkspace.config);
    }

    private async prepare(path: string): Promise<WorkspaceStatus> {
        const directoryState = await getDirectoryState(path);
        if (directoryState.status === "missing") return { status: "invalid", path: path, message: translate("repository.error.selected.missing") };
        if (directoryState.status === "not-directory") return { status: "invalid", path: path, message: translate("repository.error.selected.not.directory") };

        const configPath = join(path, WORKSPACE_CONFIG_FILE_NAME);
        const existingConfig = await this.readConfig(configPath);

        if (existingConfig.status === "ok") {
            const config = this.normalizeConfig(existingConfig.config);
            if (!areWorkspaceConfigsEqual(existingConfig.config, config)) await this.writeConfig(path, config);
            return this.createReadyWorkspace(path, config);
        }

        if (!directoryState.isEmpty) {
            return {
                status: "invalid",
                path: path,
                message:
                    existingConfig.status === "missing"
                        ? translate("repository.error.non.empty.without.config", { fileName: WORKSPACE_CONFIG_FILE_NAME })
                        : translate("repository.error.invalid.existing.config", { fileName: WORKSPACE_CONFIG_FILE_NAME })
            };
        }

        const config: WorkspaceConfig = this.normalizeConfig({
            selectedChannelId: DEFAULT_GAME_CHANNEL_ID,
            customGameChannels: [],
            activeGameBundleByChannel: {}
        });

        await this.writeConfig(path, config);
        return this.createReadyWorkspace(path, config);
    }

    private normalizeConfig(config: Partial<WorkspaceConfig>): WorkspaceConfig {
        const customChannels = Array.isArray(config.customGameChannels) ? config.customGameChannels.map(normalizeCustomChannel).filter((channel) => channel !== null) : [];
        const channels = this.createEffectiveGameChannels(customChannels);
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

        const config = await this.readConfig(join(path, WORKSPACE_CONFIG_FILE_NAME));
        if (config.status === "ok") {
            const normalizedConfig = this.normalizeConfig(config.config);
            if (!areWorkspaceConfigsEqual(config.config, normalizedConfig)) await this.writeConfig(path, normalizedConfig);
            return this.createReadyWorkspace(path, normalizedConfig);
        }

        return {
            status: "invalid",
            path: path,
            message:
                config.status === "missing"
                    ? translate("repository.error.saved.without.config", { fileName: WORKSPACE_CONFIG_FILE_NAME })
                    : translate("repository.error.saved.invalid.config", { fileName: WORKSPACE_CONFIG_FILE_NAME })
        };
    }

    private createReadyWorkspace(path: string, config: WorkspaceConfig): ReadyWorkspaceStatus {
        const gameChannels = this.createEffectiveGameChannels(config.customGameChannels);
        const selectedGameChannel = gameChannels.find((channel) => channel.id === config.selectedChannelId) ?? gameChannels.find((channel) => channel.id === DEFAULT_GAME_CHANNEL_ID) ?? gameChannels[0];
        if (selectedGameChannel === undefined) throw new Error("Workspace has no game channels");
        return { status: "ready", path, config, gameChannels, selectedGameChannel };
    }

    private createEffectiveGameChannels(customChannels: GameChannelDefinition[]): GameChannelDefinition[] {
        const customIds = new Set(customChannels.map((channel) => channel.id));
        return [...BUILT_IN_GAME_CHANNELS.filter((channel) => !customIds.has(channel.id)), ...customChannels];
    }

    private applyReadyWorkspace(path: string, config: WorkspaceConfig): ReadyWorkspaceStatus {
        const status = this.createReadyWorkspace(path, config);
        this.workspaceStatus = status;
        const settings = configToWorkspaceSettings(config);
        broadcastIPC(Bridge.Settings.changed, settings);
        return status;
    }

    private requireReadyWorkspace(): ReadyWorkspaceStatus {
        const workspace = this.getReadyWorkspace();
        if (workspace === null) throw new Error("Workspace is not ready");
        return workspace;
    }

    private async readConfig(configPath: string): Promise<{ status: "ok"; config: WorkspaceConfig } | { status: "missing" } | { status: "invalid" }> {
        return this.withConfigIo(async () => {
            try {
                const content = await readFile(configPath, "utf8");
                const parsed = parseWorkspaceConfig(content, configPath);
                if (!isWorkspaceConfig(parsed)) return { status: "invalid" };
                return { status: "ok", config: parsed };
            } catch (error) {
                if (isNodeError(error) && error.code === "ENOENT") return { status: "missing" };
                console.error("[workspace] failed to read config", error);
                return { status: "invalid" };
            }
        });
    }

    private async writeConfig(workspacePath: string, config: WorkspaceConfig): Promise<void> {
        await this.withConfigIo(async () => {
            const configPath = join(workspacePath, WORKSPACE_CONFIG_FILE_NAME);
            const tempPath = join(workspacePath, `${WORKSPACE_CONFIG_FILE_NAME}.${process.pid}.${Date.now()}.tmp`);

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

function configToWorkspaceSettings(config: WorkspaceConfig): SettingsIPC {
    return {
        releaseAssetVariant: config.releaseAssetVariant,
        backupsEnabled: config.backupsEnabled,
        autoBackupLimit: config.autoBackupLimit,
        manualBackupRotationLimit: config.manualBackupRotationLimit,
        autoBackupCooldown: config.autoBackupCooldown
    };
}

function areWorkspaceConfigsEqual(left: WorkspaceConfig, right: WorkspaceConfig): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeAssetNameIncludes(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
    return typeof value === "string" && value.length > 0 ? [value] : [];
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

function parseWorkspaceConfig(content: string, sourceName: string): unknown {
    const errors: ParseError[] = [];
    const value = parse(content, errors, {
        allowTrailingComma: true,
        disallowComments: false
    });

    if (errors.length > 0) {
        const error = errors[0];
        const position = getLineColumn(content, error.offset);
        const reason = printParseErrorCode(error.error);

        throw new Error(`Invalid JSONC in ${sourceName}: ${reason} at ${position.line}:${position.column}`);
    }

    return value;
}

function getLineColumn(content: string, offset: number): { line: number; column: number } {
    const prefix = content.slice(0, offset);
    const lines = prefix.split(/\r\n|\r|\n/);

    return {
        line: lines.length,
        column: lines[lines.length - 1].length + 1
    };
}

function isWorkspaceConfig(value: unknown): value is WorkspaceConfig {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidate = value as Partial<WorkspaceConfig>;

    // noinspection SuspiciousTypeOfGuard - bcz this is type/file guard
    return (
        candidate.schemaVersion === 1 &&
        (candidate.selectedChannelId === undefined || typeof candidate.selectedChannelId === "string") &&
        (candidate.customGameChannels === undefined || Array.isArray(candidate.customGameChannels)) &&
        (candidate.activeGameBundleByChannel === undefined ||
            (typeof candidate.activeGameBundleByChannel === "object" && candidate.activeGameBundleByChannel !== null && !Array.isArray(candidate.activeGameBundleByChannel)))
    );
}

function isBackupRotationLimit(value: unknown): value is TBackupRotationLimit {
    return value === "disabled" || value === "3" || value === "5" || value === "10";
}
function isReleaseAssetVariant(value: unknown): value is TReleaseAssetVariant {
    return value === "graphics-and-sounds" || value === "graphics" || value === "tiles";
}
function isAutoBackupLimit(value: unknown): value is TAutoBackupLimit {
    return value === "disabled" || value === "3" || value === "5" || value === "10";
}
function isAutoBackupCooldown(value: unknown): value is TAutoBackupCooldown {
    return value === "disabled" || value === "5s" || value === "15s" || value === "1m";
}

export const workspaceService = new WorkspaceService();
