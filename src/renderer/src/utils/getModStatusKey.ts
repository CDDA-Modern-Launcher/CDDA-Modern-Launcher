import { ModInstanceInfo } from "../../../shared/mods/ModInstanceInfo";

export function getModStatusKey(mod: ModInstanceInfo): string {
    if (mod.status === "update-available") return "contentSheet.mods.status.updateAvailable";
    if (mod.status === "blocked-by-local-changes") return "contentSheet.mods.status.blockedByLocalChanges";
    if (mod.status === "missing-local-copy") return "contentSheet.mods.status.missingLocalCopy";
    if (mod.status === "invalid-local-copy") return "contentSheet.mods.status.invalidLocalCopy";
    if (mod.status === "error") return "contentSheet.mods.status.error";
    return "contentSheet.mods.status.installed";
}
