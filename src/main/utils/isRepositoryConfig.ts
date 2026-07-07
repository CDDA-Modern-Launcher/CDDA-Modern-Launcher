import { RepositoryConfig } from "../../shared/RepositoryConfig";

export function isRepositoryConfig(value: unknown): value is RepositoryConfig {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidate = value as Partial<RepositoryConfig>;
    return candidate.schemaVersion === 1 && candidate.selectedChannelId === undefined && (candidate.customGameChannels === undefined || Array.isArray(candidate.customGameChannels));
}
