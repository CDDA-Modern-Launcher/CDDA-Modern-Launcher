import { GameChannelDefinition } from "../game-channel/GameChannelDefinition";
import { GameBundle } from "./GameBundle";
import { GithubRelease } from "../GithubRelease";
import { GameSaveSummary } from "../GameSaveSummary";
import { BackupSummary } from "../backups/types/BackupSummary";
import { GameRuntimeState } from "../GameRuntimeState";

export type GameBundleState =
    | { status: "loading" }
    | { status: "unavailable"; message: string }
    | { status: "error"; message?: string }
    | {
          status: "ready";
          workspacePath: string;
          channel: GameChannelDefinition;
          gameBundle: GameBundle | null;
          gameBundles: GameBundle[];
          latestRelease: GithubRelease | null;
          latestReleaseError: string | null;
          updateAvailable: boolean;
          saves: GameSaveSummary | null;
          backups: BackupSummary;
          runtimeState: GameRuntimeState;
          savesStable: boolean;
      };
