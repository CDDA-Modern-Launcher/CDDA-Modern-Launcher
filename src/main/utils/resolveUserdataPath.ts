import { GameBundleManifest } from "../../shared/game-bundle/GameBundleManifest";
import { join } from "node:path";
import { USERDATA_DIRECTORY_NAME } from "../../shared/Const";
import { safePathSegment } from "./safePathSegment";

export function resolveUserdataPath(workspacePath: string, channelId: string, manifest: GameBundleManifest): string {
    if (manifest.userdataPath.length > 0) return manifest.userdataPath;
    return join(workspacePath, USERDATA_DIRECTORY_NAME, channelId, safePathSegment(manifest.releaseId));
}
