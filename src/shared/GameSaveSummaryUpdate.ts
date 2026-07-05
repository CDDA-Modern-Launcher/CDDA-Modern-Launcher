import { GameSaveSummary } from "./GameSaveSummary";

export type GameSaveSummaryUpdate = {
    installId: string;
    saves: GameSaveSummary;
};
