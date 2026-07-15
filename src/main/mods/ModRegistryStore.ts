import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { ModInfo } from "../../shared/mods/ModInfo";
import { ModRegistry } from "../../shared/mods/ModRegistry";
import { translate } from "../LocalizationService";
import { isNodeError } from "../utils/isNodeError";
import { getChannelModRepositoryPath } from "./modRepositoryPaths";

export class ModRegistryStore {
    private readonly operations = new Map<string, Promise<void>>();

    constructor(private readonly translate: (key: string, variables?: Record<string, string | number>) => string) {}

    async read(repositoryPath: string, channelId: string): Promise<ModRegistry> {
        const registryPath = this.getPath(repositoryPath, channelId);
        return this.runExclusive(registryPath, async () => {
            try {
                const content = (await readFile(registryPath, "utf8")).replace(/^\uFEFF/, "").trim();
                if (content.length === 0) return createEmptyRegistry();

                const parsed: unknown = JSON.parse(content);
                if (!isRegistry(parsed)) throw new Error();
                return parsed;
            } catch (error) {
                if (isNodeError(error) && error.code === "ENOENT") return createEmptyRegistry();

                const backupPath = `${registryPath}.invalid-${Date.now()}`;
                try {
                    await rename(registryPath, backupPath);
                    console.error(`[mods] invalid registry moved aside path=${registryPath} backupPath=${backupPath}`, error);
                    return createEmptyRegistry();
                } catch (backupError) {
                    console.error(`[mods] failed to preserve invalid registry path=${registryPath}`, backupError);
                    throw new Error(this.translate("mods.error.registry.invalid"));
                }
            }
        });
    }

    async write(repositoryPath: string, channelId: string, registry: ModRegistry): Promise<void> {
        const registryPath = this.getPath(repositoryPath, channelId);
        await this.runExclusive(registryPath, async () => {
            await mkdir(dirname(registryPath), { recursive: true });
            const temporaryPath = `${registryPath}.tmp-${process.pid}-${Date.now()}`;
            try {
                await writeFile(temporaryPath, `${JSON.stringify(registry, null, 4)}\n`, "utf8");
                await rm(registryPath, { force: true });
                await rename(temporaryPath, registryPath);
            } finally {
                await rm(temporaryPath, { force: true });
            }
        });
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

    private async runExclusive<T>(path: string, operation: () => Promise<T>): Promise<T> {
        const previous = this.operations.get(path) ?? Promise.resolve();
        let release!: () => void;
        const current = new Promise<void>((resolve) => {
            release = resolve;
        });
        const tail = previous.then(() => current);
        this.operations.set(path, tail);

        await previous;
        try {
            return await operation();
        } finally {
            release();
            if (this.operations.get(path) === tail) this.operations.delete(path);
        }
    }
}

function createEmptyRegistry(): ModRegistry {
    return { schemaVersion: 2, mods: {} };
}

function isRegistry(value: unknown): value is ModRegistry {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const registry = value as Partial<ModRegistry>;
    return registry.schemaVersion === 2 && typeof registry.mods === "object" && registry.mods !== null && !Array.isArray(registry.mods);
}

export const modRegistryStore = new ModRegistryStore(translate);
