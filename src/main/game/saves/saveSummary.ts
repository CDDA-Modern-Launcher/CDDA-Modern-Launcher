import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import type { GameSaveSettledActivity } from "../GameSaveMonitor";
import { isNodeError } from "../install/installUtils";
import { GameWorldInfo } from "../../../shared/GameWorldInfo";
import { GameSaveSummary } from "../../../shared/GameSaveSummary";

export function getAutoBackupTimerKey(installId: string, worldFolderName: string): string {
    return `${installId}:${worldFolderName}`;
}

export function isAutoBackupInCooldown(latestBackupAt: number | null, cooldownMs: number): boolean {
    return cooldownMs > 0 && latestBackupAt !== null && Date.now() - latestBackupAt < cooldownMs;
}

export function getChangedWorldFolderNames(activity: GameSaveSettledActivity): string[] {
    const folders = new Set<string>();
    for (const changedPath of activity.keyChangedPaths) {
        const normalized = changedPath.split("\\").join("/");
        const match = /(?:^|\/)save\/([^/]+)\/[^/]+$/.exec(normalized);
        if (match !== null) folders.add(match[1]);
    }
    return [...folders];
}

export async function readSaveSummary(userdataPath: string, preferredWorldName: string | null = null): Promise<GameSaveSummary> {
    const savePath = join(userdataPath, "save");
    let entries: string[];
    try {
        entries = await readdir(savePath);
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return { worlds: [], currentWorld: null };
        throw error;
    }

    const worlds = (
        await Promise.all(
            entries.map(async (entry): Promise<GameWorldInfo | null> => {
                const worldPath = join(savePath, entry);
                try {
                    if (!(await stat(worldPath)).isDirectory()) return null;
                    const character = await readFirstCharacter(worldPath);
                    return {
                        name: decodeWorldFolderName(entry),
                        folderName: entry,
                        characterName: character?.name ?? null
                    };
                } catch (error) {
                    if (isNodeError(error) && error.code === "ENOENT") return null;
                    console.error(`[game-install] failed to read world: ${worldPath}`, error);
                    return null;
                }
            })
        )
    )
        .filter((world): world is GameWorldInfo => world !== null)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    const preferredWorld = preferredWorldName === null ? null : (worlds.find((world) => world.name === preferredWorldName || world.folderName === preferredWorldName) ?? null);
    return { worlds, currentWorld: preferredWorld ?? (worlds.length === 1 ? worlds[0] : null) };
}

type CharacterSaveInfo = {
    name: string;
};

async function readFirstCharacter(worldPath: string): Promise<CharacterSaveInfo | null> {
    let entries: Array<{ isFile(): boolean; name: string }>;
    try {
        entries = await readdir(worldPath, { withFileTypes: true });
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return null;
        throw error;
    }

    const saves = await Promise.all(
        entries
            .filter((entry) => entry.isFile() && /^#.+\.sav\.zzip$/i.test(entry.name))
            .map(async (entry) => {
                return {
                    characterName: decodeCharacterName(entry.name)
                };
            })
    );
    const firstSave = saves.sort((a, b) => a.characterName.localeCompare(b.characterName, undefined, { sensitivity: "base" }))[0];
    if (firstSave === undefined) return null;
    return {
        name: firstSave.characterName
    };
}

function decodeWorldFolderName(folderName: string): string {
    const unicodeDecoded = decodeUnicodeEscapedPathSegment(folderName);
    return unicodeDecoded ?? folderName;
}

function decodeUnicodeEscapedPathSegment(value: string): string | null {
    if (!/^#U[0-9a-fA-F]{4}/.test(value)) return null;
    const decoded = value.replace(/#U([0-9a-fA-F]{4})/g, (_match, code: string) => String.fromCharCode(parseInt(code, 16))).trim();
    return decoded.length > 0 ? decoded : null;
}

function decodeCharacterName(fileName: string): string {
    const encoded = fileName.replace(/^#/, "").replace(/\.sav\.zzip$/i, "");
    const decoded = decodeCddaSaveFileName(encoded);
    return decoded ?? encoded;
}

function decodeCddaSaveFileName(encoded: string): string | null {
    const candidates = [encoded.replace(/-/g, "/").replace(/_/g, "/"), encoded.replace(/-/g, "+").replace(/_/g, "/"), encoded];

    for (const candidate of candidates) {
        const decoded = decodeBase64Utf8(candidate);
        if (decoded !== null && !decoded.includes("�")) return decoded;
    }

    return null;
}

function decodeBase64Utf8(value: string): string | null {
    try {
        const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
        const decoded = Buffer.from(padded, "base64").toString("utf8").replace(/\0/g, "").trim();
        return decoded.length > 0 ? decoded : null;
    } catch {
        return null;
    }
}
