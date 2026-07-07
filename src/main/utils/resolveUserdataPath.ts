import { GameBundleManifest } from "../../shared/distributive/GameBundleManifest";
import { join } from "node:path";
import { USERDATA_DIRECTORY_NAME } from "../../shared/Const";
import { safePathSegment } from "./safePathSegment";

export function resolveUserdataPath(repositoryPath: string, channelId: string, manifest: GameBundleManifest): string {
    if (manifest.userdataPath.length > 0) return manifest.userdataPath;
    return join(repositoryPath, USERDATA_DIRECTORY_NAME, channelId, safePathSegment(manifest.releaseId));
}
