import { createWriteStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";

import extractZip from "extract-zip";

import { GithubRelease } from "../../shared/GithubRelease";
import { RepositoryConfig } from "../../shared/RepositoryConfig";
import { GameBundle } from "../../shared/game-bundle/GameBundle";
import { GameBundleInstallOptions } from "../../shared/game-bundle/GameBundleInstallOptions";
import { GameChannelDefinition } from "../../shared/game-channel/GameChannelDefinition";
import { TReleaseAssetVariant } from "../../shared/release-asset/TReleaseAssetVariant";
import { GitHubNetworkManager } from "../network/GitHubNetworkManager";
import { WorkspaceService } from "../repository/WorkspaceService";
import { getReusableArchive } from "../utils/getReusableArchive";
import { isNodeError } from "../utils/isNodeError";
import { getReleaseCacheKey } from "../utils/releases/getReleaseCacheKey";
import { isGitHubUrl } from "../utils/releases/isGitHubUrl";
import { matchesChannelKind } from "../utils/releases/matchesChannelKind";
import { toGameRelease } from "../utils/releases/toGameRelease";
import { withGitHubPageSize } from "../utils/releases/withGitHubPageSize";
import { runCommand } from "../utils/runCommand";
import { GameBundleRegistry } from "./GameBundleRegistry";
import { GameEvents } from "./GameEvents";

const KEEP_DOWNLOADED_GAME_BUNDLES = 3;

export class GameReleaseService {
    private readonly gitHubNetwork = new GitHubNetworkManager();

    constructor(
        private readonly workspaceService: WorkspaceService,
        private readonly registry: GameBundleRegistry,
        private readonly events: GameEvents
    ) {}

    async findLatest(channel: GameChannelDefinition, forceRefresh: boolean): Promise<GithubRelease | null> {
        return (await this.fetch(channel, forceRefresh))[0] ?? null;
    }

    async fetch(channel: GameChannelDefinition, forceRefresh: boolean): Promise<GithubRelease[]> {
        const gameAssetVariant = (await this.workspaceService.getWorkspaceSettings()).releaseAssetVariant;
        return this.gitHubNetwork.getCached(getReleaseCacheKey(channel, gameAssetVariant), () => this.fetchFromGitHub(channel, forceRefresh, gameAssetVariant), { forceRefresh });
    }

    async install(repositoryPath: string, config: RepositoryConfig, channel: GameChannelDefinition, release: GithubRelease, options: GameBundleInstallOptions, gameBundlesBefore: GameBundle[]): Promise<GameBundle> {
        const gameBundlePath = this.registry.getBundlePath(repositoryPath, channel.id, release.id);
        const userdataPath = this.registry.getUserdataPath(repositoryPath, channel.id, release.id);
        const tempPath = `${gameBundlePath}.tmp-${Date.now()}`;
        const downloadPath = this.registry.getDownloadPath(repositoryPath, channel.id, basename(release.asset.name));

        await this.registry.prepareInstallTarget(gameBundlePath, userdataPath, tempPath);
        await this.downloadFile(release.asset.downloadUrl, downloadPath, release.name, release.asset.size);
        await this.extractArchive(downloadPath, tempPath, release.name);
        this.events.emitInstallProgress({ status: "preparing-saves", releaseName: release.name });
        const gameBundle = await this.registry.writeInstalledBundle(config, channel, release, options, gameBundlesBefore, tempPath, gameBundlePath, userdataPath);
        this.events.emitInstallProgress({ status: "finalizing", releaseName: release.name });
        return gameBundle;
    }

    async cleanupDownloads(repositoryPath: string, channelId: string): Promise<void> {
        const downloadsPath = this.registry.getDownloadDirectory(repositoryPath, channelId);
        let entries: string[];
        try {
            entries = await readdir(downloadsPath);
        } catch (error) {
            if (isNodeError(error) && error.code === "ENOENT") return;
            throw error;
        }
        const files = (
            await Promise.all(
                entries.map(async (entry) => {
                    const path = join(downloadsPath, entry);
                    const itemStat = await stat(path);
                    return { path, mtime: itemStat.mtimeMs, isFile: itemStat.isFile() };
                })
            )
        )
            .filter((file) => file.isFile)
            .sort((a, b) => b.mtime - a.mtime)
            .slice(KEEP_DOWNLOADED_GAME_BUNDLES);
        await Promise.all(files.map((file) => rm(file.path, { force: true })));
    }

    private async fetchFromGitHub(channel: GameChannelDefinition, forceRefresh: boolean, gameAssetVariant: TReleaseAssetVariant): Promise<GithubRelease[]> {
        const pageCount = channel.kind === "stable" ? 5 : 1;
        const releases: GithubRelease[] = [];
        for (let page = 1; page <= pageCount; page += 1) {
            const value = await this.fetchPage(channel, page, forceRefresh);
            if (!Array.isArray(value) || value.length === 0) break;
            releases.push(
                ...value
                    .map((item) => toGameRelease(item, channel, gameAssetVariant))
                    .filter((item): item is GithubRelease => item !== null)
                    .filter((item) => matchesChannelKind(item, channel))
            );
            if (channel.kind === "stable" && releases.length > 0) break;
        }
        return releases.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    }

    private async fetchPage(channel: GameChannelDefinition, page: number, forceRefresh: boolean): Promise<unknown> {
        return this.gitHubNetwork.getJson<unknown>(withGitHubPageSize(channel.releasesUrl, page), { forceRefresh });
    }

    private async downloadFile(url: string, targetPath: string, releaseName: string, expectedBytes: number): Promise<void> {
        const reusableArchive = await getReusableArchive(targetPath, expectedBytes);
        if (reusableArchive !== null) {
            this.events.emitInstallProgress({ status: "downloading", releaseName, percent: 100, transferredBytes: reusableArchive.size, totalBytes: reusableArchive.size });
            console.info(`[game-bundle] reuse downloaded archive path=${targetPath} size=${reusableArchive.size}`);
            return;
        }

        const temporaryPath = `${targetPath}.tmp-${Date.now()}`;
        const response = isGitHubUrl(url) ? await this.gitHubNetwork.fetch(url) : await fetch(url);
        if (!response.ok || response.body === null) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        const totalBytes = Number(response.headers.get("content-length"));
        const knownTotalBytes = Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : expectedBytes > 0 ? expectedBytes : null;
        let transferredBytes = 0;
        this.events.emitInstallProgress({ status: "downloading", releaseName, percent: null, transferredBytes, totalBytes: knownTotalBytes });
        await mkdir(dirname(targetPath), { recursive: true });
        await rm(temporaryPath, { force: true });
        const fileStream = createWriteStream(temporaryPath);
        const source = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
        source.on("data", (chunk: Buffer | Uint8Array) => {
            transferredBytes += chunk.byteLength;
            const percent = knownTotalBytes === null ? null : Math.max(0, Math.min(100, Math.round((transferredBytes / knownTotalBytes) * 100)));
            this.events.emitInstallProgress({ status: "downloading", releaseName, percent, transferredBytes, totalBytes: knownTotalBytes });
        });
        await finished(source.pipe(fileStream));
        await rename(temporaryPath, targetPath);
    }

    private async extractArchive(archivePath: string, targetPath: string, releaseName: string): Promise<void> {
        await mkdir(targetPath, { recursive: true });
        let percent = 0;
        this.events.emitInstallProgress({ status: "extracting", releaseName, percent });
        const timer = setInterval(() => {
            percent = Math.min(96, percent + Math.max(1, Math.round((96 - percent) * 0.16)));
            this.events.emitInstallProgress({ status: "extracting", releaseName, percent });
        }, 450);
        try {
            if (archivePath.toLowerCase().endsWith(".zip")) await extractZip(archivePath, { dir: targetPath });
            else await runCommand("tar", ["-xf", archivePath, "-C", targetPath]);
            this.events.emitInstallProgress({ status: "extracting", releaseName, percent: 100 });
        } finally {
            clearInterval(timer);
        }
    }
}
