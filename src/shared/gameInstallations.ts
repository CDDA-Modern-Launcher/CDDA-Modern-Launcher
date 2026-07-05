import type { GameChannelDefinition } from "./gameChannels";

export const INSTALLS_DIRECTORY_NAME = "installs";
export const USERDATA_DIRECTORY_NAME = "userdata";
export const DOWNLOADS_DIRECTORY_NAME = "downloads";
export const INSTALL_MANIFEST_FILE_NAME = "install.json";
export const KEEP_DOWNLOADED_DISTRIBUTIVES = 3;

export type GameRelease = {
    id: string;
    name: string;
    tagName: string;
    publishedAt: string;
    htmlUrl: string;
    body: string;
    asset: {
        name: string;
        size: number;
        downloadUrl: string;
    };
};

export type GameInstallManifest = {
    schemaVersion: 1;
    channelId: string;
    releaseId: string;
    releaseName: string;
    tagName: string;
    publishedAt: string;
    htmlUrl: string;
    releaseBody?: string;
    assetName: string;
    installedAt: string;
    executablePath: string | null;
    userdataPath: string;
    copiedUserdataFromInstallId: string | null;
    source: {
        owner: string;
        repo: string;
        branch: string;
    };
};

export type GameInstall = {
    id: string;
    path: string;
    userdataPath: string;
    manifest: GameInstallManifest;
    isActive: boolean;
};

export type GameInstallState =
    | { status: "loading" }
    | { status: "unavailable"; message: string }
    | { status: "error"; message?: string }
    | {
          status: "ready";
          repositoryPath: string;
          channel: GameChannelDefinition;
          activeInstall: GameInstall | null;
          installs: GameInstall[];
          latestRelease: GameRelease | null;
          updateAvailable: boolean;
      };

export type InstallGameOptions = {
    releaseId?: string;
    makeActive: boolean;
    copyUserdata: boolean;
    removeOlderInstalls: boolean;
};

export type DeleteGameInstallOptions = {
    deleteUserdata: boolean;
};

export type InstallGameResult = { status: "installed"; state: GameInstallState; install: GameInstall } | { status: "unavailable" | "error"; message: string };
export type SetActiveGameInstallResult = { status: "updated"; state: GameInstallState } | { status: "unavailable" | "error"; message: string };
export type DeleteGameInstallResult = { status: "deleted"; state: GameInstallState } | { status: "unavailable" | "blocked" | "error"; message: string };
export type LaunchGameResult = { status: "launched" } | { status: "unavailable"; message: string };
export type OpenGameFolderResult = { status: "opened" } | { status: "unavailable" | "error"; message: string };

export type GameInstallProgress =
    | { status: "idle" }
    | { status: "resolving-release"; releaseName?: string }
    | { status: "downloading"; releaseName: string; percent: number | null; transferredBytes: number; totalBytes: number | null }
    | { status: "extracting"; releaseName: string; percent: number }
    | { status: "preparing-saves"; releaseName: string }
    | { status: "finalizing"; releaseName: string }
    | { status: "completed"; releaseName: string }
    | { status: "error"; message: string };
