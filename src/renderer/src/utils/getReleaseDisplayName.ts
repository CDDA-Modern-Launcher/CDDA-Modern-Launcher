import { GameBundle } from "../../../shared/game-bundle/GameBundle";
import { getReleaseNameDisplay } from "@renderer/utils/getReleaseNameDisplay";

export function getReleaseDisplayName(gameBundle: GameBundle): string {
    return getReleaseNameDisplay(gameBundle.manifest.releaseName || gameBundle.manifest.releaseId);
}
