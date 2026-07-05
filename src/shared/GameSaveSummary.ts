import { GameWorldInfo } from "./GameWorldInfo";

export type GameSaveSummary = {
    worlds: GameWorldInfo[];
    currentWorld: GameWorldInfo | null;
};
