import { ModInfo } from "../../shared/mods/ModInfo";
import { modAttachmentService } from "./ModAttachmentService";
import { modRegistryStore } from "./ModRegistryStore";

class ModDeploymentService {
    async synchronize(repositoryPath: string, channelId: string, userdataPaths: string[]): Promise<void> {
        const registry = await modRegistryStore.read(repositoryPath, channelId);
        await modAttachmentService.synchronize(userdataPaths, Object.values(registry.mods), (mod) => modRegistryStore.getModPath(repositoryPath, channelId, mod));
    }

    async synchronizeMods(repositoryPath: string, channelId: string, userdataPaths: string[], mods: ModInfo[]): Promise<void> {
        await modAttachmentService.synchronize(userdataPaths, mods, (mod) => modRegistryStore.getModPath(repositoryPath, channelId, mod));
    }

    async detach(userdataPaths: string[], mod: ModInfo): Promise<void> {
        await modAttachmentService.detach(userdataPaths, mod);
    }
}

export const modDeploymentService = new ModDeploymentService();
