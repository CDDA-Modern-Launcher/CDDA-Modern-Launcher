import { ModInstanceInfo } from "../../../../../shared/mods/ModInstanceInfo";

export function compareMods(left: ModInstanceInfo, right: ModInstanceInfo): number {
    if (left.updateAvailable !== right.updateAvailable) return left.updateAvailable ? -1 : 1;

    const leftInstalledAt = Date.parse(left.installedAt);
    const rightInstalledAt = Date.parse(right.installedAt);
    const leftTime = Number.isNaN(leftInstalledAt) ? 0 : leftInstalledAt;
    const rightTime = Number.isNaN(rightInstalledAt) ? 0 : rightInstalledAt;

    if (leftTime !== rightTime) return leftTime - rightTime;

    return left.id.localeCompare(right.id);
}
