import { ModInstanceInfo } from "../../../../../shared/mods/ModInstanceInfo";

export function getModStatusColor(mod: ModInstanceInfo): string {
    if (mod.status === "update-available") return "blue";
    if (mod.status === "blocked-by-local-changes") return "orange";
    if (mod.status === "missing-local-copy" || mod.status === "invalid-local-copy" || mod.status === "error") return "red";
    return "green";
}
