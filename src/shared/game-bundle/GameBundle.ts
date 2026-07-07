import { GameBundleManifest } from "./GameBundleManifest";

export type GameBundle = {
    id: string;
    path: string;
    userdataPath: string;
    manifest: GameBundleManifest;
    isActive: boolean;
};
