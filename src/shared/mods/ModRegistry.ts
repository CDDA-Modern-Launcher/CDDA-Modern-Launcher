import { ModInfo } from "./ModInfo";

export type ModRegistry = {
    schemaVersion: 2;
    mods: Record<string, ModInfo>;
};
