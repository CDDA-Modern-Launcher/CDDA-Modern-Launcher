import { DiscoveredMod } from "./DiscoveredMod";
import { ModRepositoryState } from "./ModRepositoryState";

export type EModDiscoveryResult =
    | { status: "selection-required"; sessionId: string; mods: DiscoveredMod[]; state: ModRepositoryState }
    | { status: "installed"; state: ModRepositoryState }
    | { status: "cancelled"; state: ModRepositoryState }
    | { status: "error"; message: string; state: ModRepositoryState };
