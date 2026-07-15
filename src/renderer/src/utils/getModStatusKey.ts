import { ModInstanceInfo } from "../../../shared/mods/ModInstanceInfo";
import { LocaleKeys } from "../../../shared/localization/types/LocaleFile";

export function getModStatusKey(mod: ModInstanceInfo): LocaleKeys {
    if (mod.status === "update-available") return "content.sheet.mods.status.update.available";
    if (mod.status === "blocked-by-local-changes") return mod.hasUnpushedCommits && !mod.hasLocalChanges ? "content.sheet.mods.status.unpushed.commits" : "content.sheet.mods.status.blocked.by.local.changes";
    if (mod.status === "missing-local-copy") return "content.sheet.mods.status.missing.local.copy";
    if (mod.status === "invalid-local-copy") return "content.sheet.mods.status.invalid.local.copy";
    if (mod.status === "error") return "content.sheet.mods.status.error";
    return "content.sheet.mods.status.installed";
}
