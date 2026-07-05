import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";

import extractZip from "extract-zip";

import { DEFAULT_GAME_CHANNEL_ID, findGameChannel, type GameChannelDefinition, getEffectiveGameChannels } from "../../shared/gameChannels";
import {
    DeleteGameInstallOptions,
    DeleteGameInstallResult,
    DOWNLOADS_DIRECTORY_NAME,
    GameInstall,
    GameInstallManifest,
    GameInstallProgress,
    GameInstallState,
    GameRelease,
    INSTALL_MANIFEST_FILE_NAME,
    InstallGameOptions,
    InstallGameResult,
    INSTALLS_DIRECTORY_NAME,
    KEEP_DOWNLOADED_DISTRIBUTIVES,
    SetActiveGameInstallResult,
    USERDATA_DIRECTORY_NAME
} from "../../shared/gameInstallations";
import { RepositoryConfig } from "../../shared/repository";
import { LocalRepositoryService } from "../repository/LocalRepositoryService";

const WINDOWS_EXECUTABLE_CANDIDATES = ["cataclysm-tiles.exe", "cataclysm.exe", "cataclysm-launcher.exe"];
const POSIX_EXECUTABLE_CANDIDATES = ["cataclysm-tiles", "cataclysm"];

type GitHubReleaseDto = {
    id?: number;
    name?: string | null;
    tag_name?: string;
    published_at?: string;
    html_url?: string;
    body?: string | null;
    draft?: boolean;
    assets?: GitHubAssetDto[];
};
type GitHubAssetDto = {
    name?: string;
    size?: number;
    browser_download_url?: string;
};

export class GameInstallationService {
    private progress: GameInstallProgress = { status: "idle" };
    private progressListeners = new Set<(progress: GameInstallProgress) => void>();

    constructor(private readonly repositoryService: LocalRepositoryService) {}

    onProgress(listener: (progress: GameInstallProgress) => void): () => void {
        this.progressListeners.add(listener);
        listener(this.progress);
        return () => this.progressListeners.delete(listener);
    }

    async getState(refreshLatest = false): Promise<GameInstallState> {
        const repository = await this.repositoryService.getInitialStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: "Repository is not ready." };
        const channel = getSelectedChannel(repository.config);
        const { installs } = await this.readInstallsAndRepairConfig(repository.path, repository.config, channel.id);
        const activeInstall = installs.find((install) => install.isActive) ?? null;
        const latestRelease = refreshLatest ? await this.findLatestRelease(channel) : null;
        return {
            status: "ready",
            repositoryPath: repository.path,
            channel,
            activeInstall,
            installs,
            latestRelease,
            updateAvailable: latestRelease !== null && activeInstall !== null && latestRelease.id !== activeInstall.id
        };
    }

    async getReleases(): Promise<GameRelease[]> {
        const repository = await this.repositoryService.getInitialStatus();
        return repository.status === "ready" ? this.fetchReleases(getSelectedChannel(repository.config)) : [];
    }

    async setActiveInstall(installId: string): Promise<SetActiveGameInstallResult> {
        const repository = await this.repositoryService.getInitialStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: "Repository is not ready." };
        const channel = getSelectedChannel(repository.config);
        const installs = await this.readInstalls(repository.path, repository.config, channel.id);
        if (!installs.some((install) => install.id === installId)) return { status: "error", message: "Selected install does not exist." };
        await this.repositoryService.saveConfig(repository.path, {
            ...repository.config,
            activeInstallByChannel: {
                ...repository.config.activeInstallByChannel,
                [channel.id]: installId
            }
        });
        return { status: "updated", state: await this.getState(true) };
    }

    async deleteInstall(installId: string, options: DeleteGameInstallOptions): Promise<DeleteGameInstallResult> {
        const repository = await this.repositoryService.getInitialStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: "Repository is not ready." };
        const channel = getSelectedChannel(repository.config);
        const installs = await this.readInstalls(repository.path, repository.config, channel.id);
        const install = installs.find((candidate) => candidate.id === installId);
        if (install === undefined) return { status: "error", message: "Selected install does not exist." };
        if (install.isActive)
            return {
                status: "blocked",
                message: "Active install cannot be deleted. Select another version first."
            };
        await rm(install.path, { recursive: true, force: true });
        if (options.deleteUserdata) await rm(install.userdataPath, { recursive: true, force: true });
        return { status: "deleted", state: await this.getState(true) };
    }

    async installLatest(options: InstallGameOptions): Promise<InstallGameResult> {
        this.setProgress({ status: "resolving-release" });
        const repository = await this.repositoryService.getInitialStatus();
        if (repository.status !== "ready") return { status: "unavailable", message: "Repository is not ready." };
        try {
            const channel = getSelectedChannel(repository.config);
            const releases = await this.fetchReleases(channel);
            const release = options.releaseId === undefined ? releases[0] : releases.find((candidate) => candidate.id === options.releaseId);
            if (release === undefined) {
                this.setProgress({ status: "idle" });
                return {
                    status: "error",
                    message: "No compatible release asset was found for the selected source."
                };
            }
            const installsBefore = await this.readInstalls(repository.path, repository.config, channel.id);
            const existingInstall = installsBefore.find((install) => install.id === release.id);
            if (existingInstall !== undefined) {
                if (options.makeActive) await this.setActiveInstall(existingInstall.id);
                this.setProgress({ status: "completed", releaseName: release.name });
                queueMicrotask(() => this.setProgress({ status: "idle" }));
                return {
                    status: "installed",
                    state: await this.getState(true),
                    install: existingInstall
                };
            }
            const install = await this.installRelease(repository.path, repository.config, channel, release, options, installsBefore);
            let config = repository.config;
            if (options.makeActive) {
                config = {
                    ...config,
                    activeInstallByChannel: {
                        ...config.activeInstallByChannel,
                        [channel.id]: install.id
                    }
                };
                await this.repositoryService.saveConfig(repository.path, config);
            }
            if (options.removeOlderInstalls) await this.removeOlderInstalls(repository.path, config, channel.id, install.id, true);
            await this.cleanupDownloads(repository.path, channel.id);
            this.setProgress({ status: "completed", releaseName: release.name });
            queueMicrotask(() => this.setProgress({ status: "idle" }));
            return { status: "installed", state: await this.getState(true), install };
        } catch (error) {
            console.error("[game-install] failed to install release", error);
            const message = error instanceof Error ? error.message : String(error);
            this.setProgress({ status: "error", message });
            return { status: "error", message };
        }
    }

    async launchActiveInstall(): Promise<{ status: "launched" } | { status: "unavailable"; message: string }> {
        return this.launchActiveInstallAsync();
    }

    async getInstallFolder(installId: string): Promise<string | null> {
        const state = await this.getState(false);
        if (state.status !== "ready") return null;
        return state.installs.find((install) => install.id === installId)?.path ?? null;
    }

    async getSavesFolder(installId: string): Promise<string | null> {
        const state = await this.getState(false);
        if (state.status !== "ready") return null;
        const path = state.installs.find((install) => install.id === installId)?.userdataPath ?? null;
        if (path !== null) await mkdir(path, { recursive: true });
        return path;
    }

    private setProgress(progress: GameInstallProgress): void {
        this.progress = progress;
        for (const listener of this.progressListeners) listener(progress);
    }

    private async launchActiveInstallAsync(): Promise<{ status: "launched" } | { status: "unavailable"; message: string }> {
        const state = await this.getState(false);
        if (state.status !== "ready") return { status: "unavailable", message: "Repository is not ready." };
        if (state.activeInstall === null) return { status: "unavailable", message: "Game is not installed." };

        const executablePath = await this.resolveExecutablePath(state.activeInstall);
        if (executablePath === null)
            return {
                status: "unavailable",
                message: "Game executable was not found. The install may have been removed or damaged."
            };

        await mkdir(state.activeInstall.userdataPath, { recursive: true });
        const child = spawn(executablePath, ["--userdir", state.activeInstall.userdataPath], { cwd: dirname(executablePath), detached: true, stdio: "ignore" });
        child.unref();
        return { status: "launched" };
    }

    private async resolveExecutablePath(install: GameInstall): Promise<string | null> {
        const manifestExecutablePath = install.manifest.executablePath;
        if (manifestExecutablePath !== null && (await pathExists(manifestExecutablePath))) return manifestExecutablePath;
        return findExecutable(install.path);
    }

    private async installRelease(repositoryPath: string, config: RepositoryConfig, channel: GameChannelDefinition, release: GameRelease, options: InstallGameOptions, installsBefore: GameInstall[]): Promise<GameInstall> {
        const installPath = join(repositoryPath, INSTALLS_DIRECTORY_NAME, channel.id, safePathSegment(release.id));
        const userdataPath = join(repositoryPath, USERDATA_DIRECTORY_NAME, channel.id, safePathSegment(release.id));
        const tempPath = `${installPath}.tmp-${Date.now()}`;
        const downloadPath = join(repositoryPath, DOWNLOADS_DIRECTORY_NAME, channel.id, basename(release.asset.name));
        await mkdir(dirname(installPath), { recursive: true });
        await mkdir(dirname(userdataPath), { recursive: true });
        await rm(tempPath, { recursive: true, force: true });
        await rm(installPath, { recursive: true, force: true });
        await this.downloadFile(release.asset.downloadUrl, downloadPath, release.name);
        await this.extractArchive(downloadPath, tempPath, release.name);
        const executablePath = await findExecutable(tempPath);
        const sourceUserdata = options.copyUserdata ? findUserdataSource(installsBefore, config.activeInstallByChannel[channel.id]) : null;
        this.setProgress({ status: "preparing-saves", releaseName: release.name });
        await mkdir(userdataPath, { recursive: true });
        if (sourceUserdata !== null && (await pathExists(sourceUserdata.userdataPath))) await copyDirectoryContents(sourceUserdata.userdataPath, userdataPath);
        const manifest: GameInstallManifest = {
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
            executablePath: executablePath === null ? null : join(installPath, relative(tempPath, executablePath)),
            userdataPath,
            copiedUserdataFromInstallId: sourceUserdata?.id ?? null,
            source: {
                owner: channel.githubOwner,
                repo: channel.githubRepo,
                branch: channel.githubBranch
            }
        };
        this.setProgress({ status: "finalizing", releaseName: release.name });
        await writeFile(join(tempPath, INSTALL_MANIFEST_FILE_NAME), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
        await rename(tempPath, installPath);
        return {
            id: release.id,
            path: installPath,
            userdataPath,
            manifest,
            isActive: false
        };
    }

    private async readInstallsAndRepairConfig(repositoryPath: string, config: RepositoryConfig, channelId: string): Promise<{ config: RepositoryConfig; installs: GameInstall[] }> {
        const installs = await this.readInstalls(repositoryPath, config, channelId);
        const activeInstallId = config.activeInstallByChannel[channelId] ?? null;
        const activeInstallExists = activeInstallId !== null && installs.some((install) => install.id === activeInstallId);

        if (activeInstallId === null || activeInstallExists) return { config, installs };

        const activeInstallByChannel = { ...config.activeInstallByChannel };
        delete activeInstallByChannel[channelId];
        const repairedConfig = { ...config, activeInstallByChannel };
        await this.repositoryService.saveConfig(repositoryPath, repairedConfig);
        return {
            config: repairedConfig,
            installs: installs.map((install) => ({ ...install, isActive: false }))
        };
    }

    private async readInstalls(repositoryPath: string, config: RepositoryConfig, channelId: string): Promise<GameInstall[]> {
        const channelInstallsPath = join(repositoryPath, INSTALLS_DIRECTORY_NAME, channelId);
        const activeInstallId = config.activeInstallByChannel[channelId] ?? null;
        let entries: string[];
        try {
            entries = await readdir(channelInstallsPath);
        } catch (error) {
            if (isNodeError(error) && error.code === "ENOENT") return [];
            throw error;
        }
        const installs: GameInstall[] = [];
        for (const entry of entries) {
            const installPath = join(channelInstallsPath, entry);
            try {
                if (!(await stat(installPath)).isDirectory()) continue;
                const manifest = JSON.parse(await readFile(join(installPath, INSTALL_MANIFEST_FILE_NAME), "utf8")) as unknown;
                if (!isGameInstallManifest(manifest) || manifest.channelId !== channelId) continue;
                const userdataPath = resolveUserdataPath(repositoryPath, channelId, manifest);
                const normalizedManifest = manifest.userdataPath === userdataPath ? manifest : { ...manifest, userdataPath };
                installs.push({
                    id: normalizedManifest.releaseId,
                    path: installPath,
                    userdataPath,
                    manifest: normalizedManifest,
                    isActive: normalizedManifest.releaseId === activeInstallId
                });
            } catch (error) {
                console.error(`[game-install] failed to read install: ${installPath}`, error);
            }
        }
        return installs.sort((a, b) => b.manifest.publishedAt.localeCompare(a.manifest.publishedAt));
    }

    private async findLatestRelease(channel: GameChannelDefinition): Promise<GameRelease | null> {
        return (await this.fetchReleases(channel))[0] ?? null;
    }

    private async fetchReleases(channel: GameChannelDefinition): Promise<GameRelease[]> {
        const pageCount = channel.kind === "stable" ? 5 : 1;
        const releases: GameRelease[] = [];
        for (let page = 1; page <= pageCount; page += 1) {
            const value = await this.fetchReleasePage(channel, page);
            if (!Array.isArray(value) || value.length === 0) break;
            releases.push(
                ...value
                    .map((item) => toGameRelease(item, channel))
                    .filter((item): item is GameRelease => item !== null)
                    .filter((item) => matchesChannelKind(item, channel))
            );
            if (channel.kind === "stable" && releases.length > 0) break;
        }
        return releases.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    }

    private async fetchReleasePage(channel: GameChannelDefinition, page: number): Promise<unknown> {
        const response = await fetch(withGitHubPageSize(channel.releasesUrl, page), {
            headers: {
                Accept: "application/vnd.github+json",
                "User-Agent": "Electron-CDDA-Launcher"
            }
        });
        if (!response.ok) throw new Error(`GitHub releases request failed: ${response.status} ${response.statusText}`);
        return response.json() as Promise<unknown>;
    }

    private async downloadFile(url: string, targetPath: string, releaseName: string): Promise<void> {
        const temporaryPath = `${targetPath}.tmp-${Date.now()}`;
        const response = await fetch(url);
        if (!response.ok || response.body === null) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        const totalBytes = Number(response.headers.get("content-length"));
        const knownTotalBytes = Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : null;
        let transferredBytes = 0;
        this.setProgress({
            status: "downloading",
            releaseName,
            percent: null,
            transferredBytes,
            totalBytes: knownTotalBytes
        });
        await mkdir(dirname(targetPath), { recursive: true });
        const fileStream = createWriteStream(temporaryPath);
        const source = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
        source.on("data", (chunk: Buffer | Uint8Array) => {
            transferredBytes += chunk.byteLength;
            const percent = knownTotalBytes === null ? null : Math.max(0, Math.min(100, Math.round((transferredBytes / knownTotalBytes) * 100)));
            this.setProgress({
                status: "downloading",
                releaseName,
                percent,
                transferredBytes,
                totalBytes: knownTotalBytes
            });
        });
        await finished(source.pipe(fileStream));
        await rename(temporaryPath, targetPath);
    }

    private async extractArchive(archivePath: string, targetPath: string, releaseName: string): Promise<void> {
        await mkdir(targetPath, { recursive: true });
        let percent = 0;
        this.setProgress({ status: "extracting", releaseName, percent });
        const timer = setInterval(() => {
            percent = Math.min(96, percent + Math.max(1, Math.round((96 - percent) * 0.16)));
            this.setProgress({ status: "extracting", releaseName, percent });
        }, 450);
        try {
            if (archivePath.toLowerCase().endsWith(".zip")) {
                await extractZip(archivePath, { dir: targetPath });
            } else {
                await runCommand("tar", ["-xf", archivePath, "-C", targetPath]);
            }
            this.setProgress({ status: "extracting", releaseName, percent: 100 });
        } finally {
            clearInterval(timer);
        }
    }

    private async cleanupDownloads(repositoryPath: string, channelId: string): Promise<void> {
        const downloadsPath = join(repositoryPath, DOWNLOADS_DIRECTORY_NAME, channelId);
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
            .slice(KEEP_DOWNLOADED_DISTRIBUTIVES);
        await Promise.all(files.map((file) => rm(file.path, { force: true })));
    }

    private async removeOlderInstalls(repositoryPath: string, config: RepositoryConfig, channelId: string, keepInstallId: string, deleteUserdata: boolean): Promise<void> {
        const installs = await this.readInstalls(repositoryPath, config, channelId);
        await Promise.all(
            installs
                .filter((install) => install.id !== keepInstallId)
                .map(async (install) => {
                    await rm(install.path, { recursive: true, force: true });
                    if (deleteUserdata) await rm(install.userdataPath, { recursive: true, force: true });
                })
        );
    }
}

function resolveUserdataPath(repositoryPath: string, channelId: string, manifest: GameInstallManifest): string {
    if (manifest.userdataPath.length > 0) return manifest.userdataPath;
    return join(repositoryPath, USERDATA_DIRECTORY_NAME, channelId, safePathSegment(manifest.releaseId));
}

function getSelectedChannel(config: RepositoryConfig): GameChannelDefinition {
    return findGameChannel(getEffectiveGameChannels(config.customChannels), config.selectedChannelId || DEFAULT_GAME_CHANNEL_ID);
}
function withGitHubPageSize(url: string, page: number): string {
    try {
        const value = new URL(url);
        if (value.hostname === "api.github.com") {
            if (!value.searchParams.has("per_page")) value.searchParams.set("per_page", "100");
            value.searchParams.set("page", page.toString());
        }
        return value.toString();
    } catch {
        return url;
    }
}
function matchesChannelKind(release: GameRelease, channel: GameChannelDefinition): boolean {
    const value = `${release.id} ${release.name}`.toLowerCase();
    const isExperimentalRelease = value.includes("experimental");
    return channel.kind === "experimental" ? isExperimentalRelease : !isExperimentalRelease;
}
function toAssetNameParts(value: string | string[]): string[] {
    return Array.isArray(value) ? value : [value];
}

function toGameRelease(value: unknown, channel: GameChannelDefinition): GameRelease | null {
    if (typeof value !== "object" || value === null) return null;
    const release = value as GitHubReleaseDto;
    if (release.draft === true || typeof release.tag_name !== "string" || typeof release.published_at !== "string") return null;
    const asset = release.assets?.find((candidate) => isCompatibleAsset(candidate, channel));
    if (asset?.name === undefined || asset.browser_download_url === undefined) return null;
    return {
        id: release.tag_name,
        name: release.name ?? release.tag_name,
        tagName: release.tag_name,
        publishedAt: release.published_at,
        htmlUrl: release.html_url ?? `https://github.com/${channel.githubOwner}/${channel.githubRepo}/releases/tag/${encodeURIComponent(release.tag_name)}`,
        body: release.body ?? "",
        asset: {
            name: asset.name,
            size: typeof asset.size === "number" ? asset.size : 0,
            downloadUrl: asset.browser_download_url
        }
    };
}
function isCompatibleAsset(asset: GitHubAssetDto, channel: GameChannelDefinition): boolean {
    if (typeof asset.name !== "string" || typeof asset.browser_download_url !== "string") return false;
    const platformKey = process.platform === "win32" ? "windows" : "linux";
    const requiredNameParts = toAssetNameParts(channel.assetNameIncludes[platformKey]);
    const assetName = asset.name.toLowerCase();
    const isSupportedArchive = assetName.endsWith(".zip") || assetName.endsWith(".tar.gz") || assetName.endsWith(".tgz");
    return isSupportedArchive && requiredNameParts.some((part) => part.length > 0 && assetName.includes(part.toLowerCase()));
}
function isGameInstallManifest(value: unknown): value is GameInstallManifest {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Partial<GameInstallManifest>;
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
function safePathSegment(value: string): string {
    return (
        value
            .split("")
            .map((char) => (/[<>:"/\\|?*]/.test(char) || char.charCodeAt(0) < 32 ? "_" : char))
            .join("")
            .trim() || "release"
    );
}
async function findExecutable(rootPath: string): Promise<string | null> {
    const candidates = process.platform === "win32" ? WINDOWS_EXECUTABLE_CANDIDATES : POSIX_EXECUTABLE_CANDIDATES;
    const queue = [rootPath];
    while (queue.length > 0) {
        const directory = queue.shift()!;
        const entries = await readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            const path = join(directory, entry.name);
            if (entry.isDirectory()) queue.push(path);
            else if (entry.isFile() && candidates.includes(entry.name)) return path;
        }
    }
    return null;
}
function findUserdataSource(installs: GameInstall[], activeInstallId: string | undefined): GameInstall | null {
    return (activeInstallId === undefined ? undefined : installs.find((install) => install.id === activeInstallId)) ?? installs[0] ?? null;
}
async function copyDirectoryContents(sourcePath: string, targetPath: string): Promise<void> {
    await mkdir(targetPath, { recursive: true });
    await Promise.all(
        (await readdir(sourcePath)).map((entry) =>
            cp(join(sourcePath, entry), join(targetPath, entry), {
                recursive: true,
                force: true
            })
        )
    );
}
async function pathExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}
async function runCommand(command: string, args: string[]): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const child = spawn(command, args, { stdio: "ignore" });
        child.on("error", reject);
        child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code ?? "unknown"}.`))));
    });
}
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error;
}
