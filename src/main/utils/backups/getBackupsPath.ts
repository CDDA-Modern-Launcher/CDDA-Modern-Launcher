import { GameBundle } from "../../../shared/game-bundle/GameBundle";
import { join } from "node:path";

export function getBackupsPath(gameBundle: GameBundle): string {
    return join(gameBundle.userdataPath, "backups");
}
