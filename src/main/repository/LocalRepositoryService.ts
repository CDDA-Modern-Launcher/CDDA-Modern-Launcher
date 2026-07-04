import { constants } from "node:fs";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

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
            return { status: "ready", path: repositoryPath, config: existingConfig.config };
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

        const config: RepositoryConfig = {
            schemaVersion: 1,
            createdAt: new Date().toISOString()
        };

        await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
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
            return { status: "ready", path: repositoryPath, config: config.config };
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

function isRepositoryConfig(value: unknown): value is RepositoryConfig {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidate = value as Partial<RepositoryConfig>;
    return candidate.schemaVersion === 1 && typeof candidate.createdAt === "string";
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error;
}
