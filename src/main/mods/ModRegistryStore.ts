import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { ModInfo } from "../../shared/mods/ModInfo";
import { ModRegistry } from "../../shared/mods/ModRegistry";
import { translate } from "../LocalizationService";
import { isNodeError } from "../utils/isNodeError";
import { getChannelModRepositoryPath } from "./modRepositoryPaths";

export class ModRegistryStore {
    constructor(private readonly translate: (key: string, variables?: Record<string, string | number>) => string) {}

    async read(repositoryPath: string, channelId: string): Promise<ModRegistry> {
        try {
            const parsed: unknown = JSON.parse(await readFile(this.getPath(repositoryPath, channelId), "utf8"));
            if (!isRegistry(parsed)) throw new Error();
            return parsed;
        } catch (error) {
            if (isNodeError(error) && error.code === "ENOENT") {
                const registry: ModRegistry = { schemaVersion: 2, mods: {} };
                await this.write(repositoryPath, channelId, registry);
                return registry;
            }
            throw new Error(this.translate("mods.error.registry.invalid"));
        }
    }

    async write(repositoryPath: string, channelId: string, registry: ModRegistry): Promise<void> {
        const registryPath = this.getPath(repositoryPath, channelId);
        await mkdir(dirname(registryPath), { recursive: true });
        await writeFile(registryPath, `${JSON.stringify(registry, null, 4)}\n`, "utf8");
    }

    getSourcePath(repositoryPath: string, channelId: string, mod: ModInfo): string {
        return mod.sourceType === "folder" ? mod.sourcePath : join(getChannelModRepositoryPath(repositoryPath, channelId), mod.sourcePath);
    }

    getModPath(repositoryPath: string, channelId: string, mod: ModInfo): string {
        return join(this.getSourcePath(repositoryPath, channelId, mod), mod.subdirectory);
    }

    private getPath(repositoryPath: string, channelId: string): string {
        return join(getChannelModRepositoryPath(repositoryPath, channelId), "mods.json");
    }
}

function isRegistry(value: unknown): value is ModRegistry {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const registry = value as Partial<ModRegistry>;
    return registry.schemaVersion === 2 && typeof registry.mods === "object" && registry.mods !== null && !Array.isArray(registry.mods);
}

export const modRegistryStore = new ModRegistryStore(translate);
