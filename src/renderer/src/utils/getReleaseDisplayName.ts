import { GameBundle } from "../../../shared/distributive/GameBundle";
import { getReleaseNameDisplay } from "@renderer/utils/getReleaseNameDisplay";

export function getReleaseDisplayName(install: GameBundle): string {
    return getReleaseNameDisplay(install.manifest.releaseName || install.manifest.releaseId);
}
