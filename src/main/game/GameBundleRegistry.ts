import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import { DOWNLOADS_DIRECTORY_NAME, GAME_BUNDLE_MANIFEST_FILE_NAME, GAME_BUNDLES_DIRECTORY_NAME, USERDATA_DIRECTORY_NAME } from "../../shared/Const";
import { RepositoryConfig } from "../../shared/RepositoryConfig";
import { GameBundle } from "../../shared/game-bundle/GameBundle";
import { GameBundleManifest } from "../../shared/game-bundle/GameBundleManifest";
import { GameChannelDefinition } from "../../shared/game-channel/GameChannelDefinition";
import { WorkspaceService } from "../repository/WorkspaceService";
import { copyDirectoryContents } from "../utils/copyDirectoryContents";
import { findExecutable } from "../utils/findExecutable";
import { findUserdataSource } from "../utils/findUserdataSource";
import { isGameBundleManifest } from "../utils/isGameBundleManifest";
import { isNodeError } from "../utils/isNodeError";
import { pathExists } from "../utils/pathExists";
import { resolveUserdataPath } from "../utils/resolveUserdataPath";
import { safePathSegment } from "../utils/safePathSegment";
import { GithubRelease } from "../../shared/GithubRelease";
import { GameBundleInstallOptions } from "../../shared/game-bundle/GameBundleInstallOptions";

export class GameBundleRegistry {
    constructor(private readonly workspaceService: WorkspaceService) {}

    async readAndRepair(repositoryPath: string, config: RepositoryConfig, channelId: string): Promise<{ config: RepositoryConfig; gameBundles: GameBundle[] }> {
        const gameBundles = await this.read(repositoryPath, config, channelId);
        const activeGameBundleId = config.activeGameBundleByChannel[channelId] ?? null;
        const activeGameBundleExists = activeGameBundleId !== null && gameBundles.some((gameBundle) => gameBundle.id === activeGameBundleId);
        if (activeGameBundleId === null || activeGameBundleExists) return { config, gameBundles };

        const activeGameBundleByChannel = { ...config.activeGameBundleByChannel };
        delete activeGameBundleByChannel[channelId];
        const repairedConfig = { ...config, activeGameBundleByChannel };
        await this.workspaceService.saveConfig(repositoryPath, repairedConfig);
        return { config: repairedConfig, gameBundles: gameBundles.map((gameBundle) => ({ ...gameBundle, isActive: false })) };
    }

    async read(repositoryPath: string, config: RepositoryConfig, channelId: string): Promise<GameBundle[]> {
        const channelGameBundlesPath = join(repositoryPath, GAME_BUNDLES_DIRECTORY_NAME, channelId);
        const activeGameBundleId = config.activeGameBundleByChannel[channelId] ?? null;
        let entries: string[];
        try {
            entries = await readdir(channelGameBundlesPath);
        } catch (error) {
            if (isNodeError(error) && error.code === "ENOENT") return [];
            throw error;
        }

        const gameBundles: GameBundle[] = [];
        for (const entry of entries) {
            const gameBundlePath = join(channelGameBundlesPath, entry);
            try {
                if (!(await stat(gameBundlePath)).isDirectory()) continue;
                const manifest = JSON.parse(await readFile(join(gameBundlePath, GAME_BUNDLE_MANIFEST_FILE_NAME), "utf8")) as unknown;
                if (!isGameBundleManifest(manifest) || manifest.channelId !== channelId) continue;
                const userdataPath = resolveUserdataPath(repositoryPath, channelId, manifest);
                const normalizedManifest = manifest.userdataPath === userdataPath ? manifest : { ...manifest, userdataPath };
                gameBundles.push({
                    id: normalizedManifest.releaseId,
                    path: gameBundlePath,
                    userdataPath,
                    manifest: normalizedManifest,
                    isActive: normalizedManifest.releaseId === activeGameBundleId
                });
            } catch (error) {
                console.error(`[game-bundle] failed to read game bundle: ${gameBundlePath}`, error);
            }
        }
        return gameBundles.sort((a, b) => b.manifest.publishedAt.localeCompare(a.manifest.publishedAt));
    }

    async removeOlder(repositoryPath: string, config: RepositoryConfig, channelId: string, keepGameBundleId: string, deleteUserdata: boolean): Promise<void> {
        const gameBundles = await this.read(repositoryPath, config, channelId);
        await Promise.all(
            gameBundles
                .filter((bundle) => bundle.id !== keepGameBundleId)
                .map(async (bundle) => {
                    await rm(bundle.path, { recursive: true, force: true });
                    if (deleteUserdata) await rm(bundle.userdataPath, { recursive: true, force: true });
                })
        );
    }

    async delete(gameBundle: GameBundle, deleteUserdata: boolean): Promise<void> {
        await rm(gameBundle.path, { recursive: true, force: true });
        if (deleteUserdata) await rm(gameBundle.userdataPath, { recursive: true, force: true });
    }

    async writeInstalledBundle(
        config: RepositoryConfig,
        channel: GameChannelDefinition,
        release: GithubRelease,
        options: GameBundleInstallOptions,
        gameBundlesBefore: GameBundle[],
        tempPath: string,
        gameBundlePath: string,
        userdataPath: string
    ): Promise<GameBundle> {
        const executablePath = await findExecutable(tempPath);
        const sourceUserdata = options.copyUserdata ? findUserdataSource(gameBundlesBefore, config.activeGameBundleByChannel[channel.id]) : null;
        await mkdir(userdataPath, { recursive: true });
        if (sourceUserdata !== null && (await pathExists(sourceUserdata.userdataPath))) await copyDirectoryContents(sourceUserdata.userdataPath, userdataPath);

        const manifest: GameBundleManifest = {
            schemaVersion: 1,
            channelId: channel.id,
            releaseId: release.id,
            releaseName: release.name,
            tagName: release.tagName,
            publishedAt: release.publishedAt,
            htmlUrl: release.htmlUrl,
            releaseBody: release.body,
            assetName: release.asset.name,
            installedAt: new Date().toISOString(),
            executablePath: executablePath === null ? null : join(gameBundlePath, relative(tempPath, executablePath)),
            userdataPath,
            copiedUserdataFromGameBundleId: sourceUserdata?.id ?? null,
            source: { owner: channel.githubOwner, repo: channel.githubRepo, branch: channel.githubBranch }
        };
        await writeFile(join(tempPath, GAME_BUNDLE_MANIFEST_FILE_NAME), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
        await rename(tempPath, gameBundlePath);
        return { id: release.id, path: gameBundlePath, userdataPath, manifest, isActive: false };
    }

    getBundlePath(repositoryPath: string, channelId: string, releaseId: string): string {
        return join(repositoryPath, GAME_BUNDLES_DIRECTORY_NAME, channelId, safePathSegment(releaseId));
    }

    getUserdataPath(repositoryPath: string, channelId: string, releaseId: string): string {
        return join(repositoryPath, USERDATA_DIRECTORY_NAME, channelId, safePathSegment(releaseId));
    }

    getDownloadDirectory(repositoryPath: string, channelId: string): string {
        return join(repositoryPath, DOWNLOADS_DIRECTORY_NAME, channelId);
    }

    getDownloadPath(repositoryPath: string, channelId: string, assetName: string): string {
        return join(this.getDownloadDirectory(repositoryPath, channelId), assetName);
    }

    async prepareInstallTarget(gameBundlePath: string, userdataPath: string, tempPath: string): Promise<void> {
        await mkdir(dirname(gameBundlePath), { recursive: true });
        await mkdir(dirname(userdataPath), { recursive: true });
        await rm(tempPath, { recursive: true, force: true });
        await rm(gameBundlePath, { recursive: true, force: true });
    }
}
