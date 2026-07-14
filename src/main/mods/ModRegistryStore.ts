import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { ModInfo } from "../../shared/mods/ModInfo";
import { ModRegistry } from "../../shared/mods/ModRegistry";
import { translate } from "../LocalizationService";
import { isNodeError } from "../utils/isNodeError";
import { getChannelModRepositoryPath } from "./modRepositoryPaths";
import { normalizeModDisplayName } from "./normalizeModDisplayName";

export class ModRegistryStore {
    constructor(private readonly translate: (key: string, variables?: Record<string, string | number>) => string) {}

    async read(repositoryPath: string, channelId: string): Promise<ModRegistry> {
        const registryPath = this.getPath(repositoryPath, channelId);

        try {
            const parsed: unknown = JSON.parse(await readFile(registryPath, "utf8"));
            return normalizeRegistry(parsed);
        } catch (error) {
            if (isNodeError(error) && error.code === "ENOENT") {
                const registry = createEmptyRegistry();
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

    getModPath(repositoryPath: string, channelId: string, mod: ModInfo): string {
        return join(getChannelModRepositoryPath(repositoryPath, channelId), mod.relativePath);
    }

    private getPath(repositoryPath: string, channelId: string): string {
        return join(getChannelModRepositoryPath(repositoryPath, channelId), "mods.json");
    }
}

function createEmptyRegistry(): ModRegistry {
    return { schemaVersion: 1, mods: {} };
}

function normalizeRegistry(value: unknown): ModRegistry {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return createEmptyRegistry();
    }

    const candidate = value as Partial<ModRegistry>;
    const mods: Record<string, ModInfo> = {};

    if (typeof candidate.mods === "object" && candidate.mods !== null && !Array.isArray(candidate.mods)) {
        for (const value of Object.values(candidate.mods)) {
            const mod = normalizeInstalledMod(value);
            if (mod !== null) mods[mod.id] = mod;
        }
    }

    return { schemaVersion: 1, mods };
}

function normalizeInstalledMod(value: unknown): ModInfo | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

    const candidate = value as Partial<ModInfo>;
    if (typeof candidate.id !== "string" || candidate.id.length === 0 || typeof candidate.sourceUrl !== "string" || typeof candidate.relativePath !== "string") {
        return null;
    }

    const now = new Date().toISOString();
    const defaultBranch = typeof candidate.defaultBranch === "string" && candidate.defaultBranch.length > 0 ? candidate.defaultBranch : "master";

    return {
        schemaVersion: 1,
        id: candidate.id,
        displayName: normalizeModDisplayName(candidate.displayName, candidate.id),
        sourceUrl: candidate.sourceUrl,
        defaultBranch,
        trackingRef: typeof candidate.trackingRef === "string" && candidate.trackingRef.length > 0 ? candidate.trackingRef : `refs/remotes/origin/${defaultBranch}`,
        installedCommit: typeof candidate.installedCommit === "string" ? candidate.installedCommit : "",
        lastKnownRemoteCommit: typeof candidate.lastKnownRemoteCommit === "string" ? candidate.lastKnownRemoteCommit : typeof candidate.installedCommit === "string" ? candidate.installedCommit : "",
        hasLocalChanges: candidate.hasLocalChanges === true,
        updateAvailable: candidate.updateAvailable === true,
        relativePath: candidate.relativePath,
        installedAt: typeof candidate.installedAt === "string" ? candidate.installedAt : now,
        checkedAt: typeof candidate.checkedAt === "string" ? candidate.checkedAt : undefined,
        updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : now,
        enabled: candidate.enabled !== false
    };
}

export const modRegistryStore = new ModRegistryStore(translate);
