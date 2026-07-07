import { GameSaveSummary } from "../../../shared/GameSaveSummary";
import { join } from "node:path";
import { readdir, stat } from "node:fs/promises";
import { isNodeError } from "../isNodeError";
import { GameWorldInfo } from "../../../shared/GameWorldInfo";
import { readFirstCharacter } from "./readFirstCharacter";
import { decodeWorldFolderName } from "./decodeWorldFolderName";

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
                        characterName: character ?? null
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
