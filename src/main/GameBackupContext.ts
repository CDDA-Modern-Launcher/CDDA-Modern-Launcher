import { GameBundle } from "../shared/game-bundle/GameBundle";
import { GameSaveSummary } from "../shared/GameSaveSummary";

export type GameBackupContext = {
    gameBundle: GameBundle;
    saves: GameSaveSummary | null;
    gameRunning: boolean;
    savesStable: boolean;
};
