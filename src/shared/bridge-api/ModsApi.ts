import { ModRepositoryState } from "../mods/ModRepositoryState";
import { EModInstallResult } from "../mods/EModInstallResult";
import { EModsCheckResult } from "../mods/EModsCheckResult";
import { UpdateModOptions } from "../mods/UpdateModOptions";
import { EModUpdateResult } from "../mods/EModUpdateResult";
import { EModDeleteResult } from "../mods/EModDeleteResult";
import { EModOpenFolderResult } from "../mods/EModOpenFolderResult";
import { ModRepositoryChangedEvent } from "../mods/ModRepositoryChangedEvent";
import { ModRepositoryNoticeEvent } from "../mods/ModRepositoryNoticeEvent";

export type ModsApi = {
    getState: () => Promise<ModRepositoryState>;
    installFromUrl: (url: string) => Promise<EModInstallResult>;
    checkUpdates: () => Promise<EModsCheckResult>;
    update: (modId: string, options?: UpdateModOptions) => Promise<EModUpdateResult>;
    remove: (modId: string) => Promise<EModDeleteResult>;
    openFolder: (modId?: string) => Promise<EModOpenFolderResult>;
    onChanged: (callback: (event: ModRepositoryChangedEvent) => void) => () => void;
    onNotice: (callback: (event: ModRepositoryNoticeEvent) => void) => () => void;
};
