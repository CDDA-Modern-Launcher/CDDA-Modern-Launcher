import { GameSaveSummary } from "./GameSaveSummary";

export type GameSaveSummaryUpdate = {
    gameBundleId: string;
    saves: GameSaveSummary;
};
