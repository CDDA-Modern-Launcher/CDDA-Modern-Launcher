import { RepositoryConfig } from "../../shared/RepositoryConfig";

export function isRepositoryConfig(value: unknown): value is RepositoryConfig {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidate = value as Partial<RepositoryConfig>;

    // noinspection SuspiciousTypeOfGuard - bcz this is type/file guard
    return (
        candidate.schemaVersion === 1 &&
        (candidate.selectedChannelId === undefined || typeof candidate.selectedChannelId === "string") &&
        (candidate.customGameChannels === undefined || Array.isArray(candidate.customGameChannels)) &&
        (candidate.activeGameBundleByChannel === undefined ||
            (typeof candidate.activeGameBundleByChannel === "object" && candidate.activeGameBundleByChannel !== null && !Array.isArray(candidate.activeGameBundleByChannel)))
    );
}
