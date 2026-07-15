import { ModRepositoryState } from "../mods/ModRepositoryState";
import { EModInstallResult } from "../mods/EModInstallResult";
import { EModDiscoveryResult } from "../mods/EModDiscoveryResult";
import { EModsCheckResult } from "../mods/EModsCheckResult";
import { UpdateModOptions } from "../mods/UpdateModOptions";
import { EModUpdateResult } from "../mods/EModUpdateResult";
import { EModDeleteResult } from "../mods/EModDeleteResult";
import { EModOpenFolderResult } from "../mods/EModOpenFolderResult";
import { ModRepositoryChangedEvent } from "../mods/ModRepositoryChangedEvent";
import { ModRepositoryNoticeEvent } from "../mods/ModRepositoryNoticeEvent";
import { ModInstallSelection } from "../mods/ModInstallSelection";

export type ModsApi = {
    getState: () => Promise<ModRepositoryState>;
    discoverFromGit: (url: string) => Promise<EModDiscoveryResult>;
    discoverFromArchive: () => Promise<EModDiscoveryResult>;
    installFromFolder: () => Promise<EModInstallResult>;
    installSelection: (selection: ModInstallSelection) => Promise<EModInstallResult>;
    checkUpdates: () => Promise<EModsCheckResult>;
    update: (modId: string, options?: UpdateModOptions) => Promise<EModUpdateResult>;
    remove: (modId: string) => Promise<EModDeleteResult>;
    openFolder: (modId?: string) => Promise<EModOpenFolderResult>;
    onChanged: (callback: (event: ModRepositoryChangedEvent) => void) => () => void;
    onNotice: (callback: (event: ModRepositoryNoticeEvent) => void) => () => void;
};
