import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

import { DiscoveredMod } from "../../shared/mods/DiscoveredMod";
import { translate } from "../LocalizationService";
import { fileExists } from "./fileExists";
import { readValidatedModInfo } from "./readValidatedModInfo";

class ModDiscoveryService {
    async discover(rootPath: string): Promise<DiscoveredMod[]> {
        const candidates = await this.findModDirectories(rootPath);
        if (candidates.length === 0) throw new Error(translate("mods.error.modinfo.not.found"));

        const found: DiscoveredMod[] = [];
        const ids = new Set<string>();
        for (const candidatePath of candidates) {
            const info = await readValidatedModInfo(candidatePath, translate);
            if (ids.has(info.id)) throw new Error(translate("mods.error.duplicate.id", { id: info.id }));
            ids.add(info.id);
            found.push({
                id: info.id,
                name: info.name,
                description: info.description,
                subdirectory: relative(rootPath, candidatePath)
            });
        }

        return found.sort((a, b) => a.name.localeCompare(b.name));
    }

    private async findModDirectories(directoryPath: string): Promise<string[]> {
        if (await fileExists(join(directoryPath, "modinfo.json"))) return [directoryPath];

        const found: string[] = [];
        for (const entry of await readdir(directoryPath, { withFileTypes: true })) {
            if (!entry.isDirectory() || entry.name === ".git") continue;
            found.push(...(await this.findModDirectories(join(directoryPath, entry.name))));
        }
        return found;
    }
}

export const modDiscoveryService = new ModDiscoveryService();
