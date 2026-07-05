import { ChildProcess, spawn } from "node:child_process";
import { access, cp, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

import { RepositoryConfig } from "../../../shared/RepositoryConfig";
import { GameChannelDefinition } from "../../../shared/game-channel/GameChannelDefinition";
import { DEFAULT_GAME_CHANNEL_ID, USERDATA_DIRECTORY_NAME } from "../../../shared/Const";
import { getEffectiveGameChannels } from "../../../shared/game-channel/getEffectiveGameChannels";
import { findGameChannel } from "../../../shared/game-channel/findGameChannel";
import { DistributiveInfo } from "../../../shared/distributive/DistributiveInfo";
import { Distributive } from "../../../shared/distributive/Distributive";

const WINDOWS_EXECUTABLE_CANDIDATES = ["cataclysm-tiles.exe", "cataclysm.exe", "cataclysm-launcher.exe"];
const POSIX_EXECUTABLE_CANDIDATES = ["cataclysm-tiles", "cataclysm"];

export function resolveUserdataPath(repositoryPath: string, channelId: string, manifest: DistributiveInfo): string {
    if (manifest.userdataPath.length > 0) return manifest.userdataPath;
    return join(repositoryPath, USERDATA_DIRECTORY_NAME, channelId, safePathSegment(manifest.releaseId));
}

export function getSelectedChannel(config: RepositoryConfig): GameChannelDefinition {
    return findGameChannel(getEffectiveGameChannels(config.customGameChannels), config.selectedChannelId || DEFAULT_GAME_CHANNEL_ID);
}

export function isGitHubUrl(url: string): boolean {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host === "github.com" || host.endsWith(".github.com") || host === "githubusercontent.com" || host.endsWith(".githubusercontent.com");
    } catch {
        return false;
    }
}

export function isGameInstallManifest(value: unknown): value is DistributiveInfo {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Partial<DistributiveInfo>;
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

export function safePathSegment(value: string): string {
    return (
        value
            .split("")
            .map((char) => (/[<>:"/\\|?*]/.test(char) || char.charCodeAt(0) < 32 ? "_" : char))
            .join("")
            .trim() || "release"
    );
}

export async function findExecutable(rootPath: string): Promise<string | null> {
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

export function findUserdataSource(installs: Distributive[], activeInstallId: string | undefined): Distributive | null {
    return (activeInstallId === undefined ? undefined : installs.find((install) => install.id === activeInstallId)) ?? installs[0] ?? null;
}

export async function copyDirectoryContents(sourcePath: string, targetPath: string): Promise<void> {
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

export async function pathExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

export async function runCommand(command: string, args: string[]): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const child: ChildProcess = spawn(command, args, { stdio: "ignore" });
        child.on("error", reject);
        child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code ?? "unknown"}.`))));
    });
}

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error;
}
