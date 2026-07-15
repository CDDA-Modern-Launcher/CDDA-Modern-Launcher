import { basename } from "node:path";

const MASTER_SAVE_FILE_NAME = "master.gsav";
const PLAYER_SAVE_FILE_PATTERN = /^#.+\.sav(?:\.zzip)?$/i;

export function getKeySaveFileKind(path: string): "master" | "player" | null {
    const name = basename(path).toLowerCase();
    if (name === MASTER_SAVE_FILE_NAME) return "master";
    if (PLAYER_SAVE_FILE_PATTERN.test(name)) return "player";
    return null;
}
