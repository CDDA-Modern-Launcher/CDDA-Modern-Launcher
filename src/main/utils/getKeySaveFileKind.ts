import { basename } from "node:path";

const MASTER_SAVE_FILE_NAME = "master.gsav";
const PLAYER_SAVE_ARCHIVE_EXTENSION = ".sav.zzip";

export function getKeySaveFileKind(path: string): "master" | "player" | null {
    const name = basename(path).toLowerCase();
    if (name === MASTER_SAVE_FILE_NAME) return "master";
    if (name.endsWith(PLAYER_SAVE_ARCHIVE_EXTENSION)) return "player";
    return null;
}
