import { ModInfo } from "./ModInfo";

export type ModRegistry = {
    schemaVersion: 1;
    mods: Record<string, ModInfo>;
};
