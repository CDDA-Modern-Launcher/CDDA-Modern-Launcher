import { GameBundleManifest } from "../../shared/game-bundle/GameBundleManifest";

export function isGameBundleManifest(value: unknown): value is GameBundleManifest {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Partial<GameBundleManifest>;
    return (
        candidate.schemaVersion === 1 &&
        typeof candidate.channelId === "string" &&
        typeof candidate.releaseId === "string" &&
        typeof candidate.releaseName === "string" &&
        typeof candidate.tagName === "string" &&
        typeof candidate.publishedAt === "string" &&
        typeof candidate.htmlUrl === "string" &&
        typeof candidate.assetName === "string" &&
        typeof candidate.installedAt === "string" &&
        (candidate.executablePath === null || typeof candidate.executablePath === "string") &&
        typeof candidate.userdataPath === "string"
    );
}
