import { readdir } from "node:fs/promises";
import { isNodeError } from "../isNodeError";
import { decodeCharacterName } from "./decodeCharacterName";

export async function readFirstCharacter(worldPath: string): Promise<string | null> {
    let entries: Array<{ isFile(): boolean; name: string }>;
    try {
        entries = await readdir(worldPath, { withFileTypes: true });
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return null;
        throw error;
    }

    const saves = await Promise.all(
        entries
            .filter((entry) => entry.isFile() && /^#.+\.sav(?:\.zzip)?$/i.test(entry.name))
            .map(async (entry) => {
                return {
                    characterName: decodeCharacterName(entry.name)
                };
            })
    );
    const firstSave = saves.sort((a, b) => a.characterName.localeCompare(b.characterName, undefined, { sensitivity: "base" }))[0];
    if (firstSave === undefined) return null;
    return firstSave.characterName;
}
