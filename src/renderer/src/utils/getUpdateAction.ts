import { GithubRelease } from "../../../shared/GithubRelease";

export function getUpdateAction(updateAvailable: boolean, latestRelease: GithubRelease | null, latestInstalledId: string | null): "install" | "activate" | null {
    if (!updateAvailable || latestRelease === null) return null;
    return latestInstalledId === null ? "install" : "activate";
}
