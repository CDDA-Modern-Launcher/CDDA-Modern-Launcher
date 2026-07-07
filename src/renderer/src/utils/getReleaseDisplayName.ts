import { Distributive } from "../../../shared/distributive/Distributive";
import { getReleaseNameDisplay } from "@renderer/utils/getReleaseNameDisplay";

export function getReleaseDisplayName(install: Distributive): string {
    return getReleaseNameDisplay(install.manifest.releaseName || install.manifest.releaseId);
}
