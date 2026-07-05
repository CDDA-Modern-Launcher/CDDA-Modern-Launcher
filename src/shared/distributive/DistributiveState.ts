import { GameChannelDefinition } from "../game-channel/GameChannelDefinition";
import { Distributive } from "./Distributive";
import { GithubRelease } from "../GithubRelease";
import { GameSaveSummary } from "../GameSaveSummary";
import { BackupSummary } from "../backups/types/BackupSummary";
import { GameRuntimeState } from "../GameRuntimeState";

export type DistributiveState =
    | { status: "loading" }
    | { status: "unavailable"; message: string }
    | { status: "error"; message?: string }
    | {
          status: "ready";
          repositoryPath: string;
          channel: GameChannelDefinition;
          distributive: Distributive | null;
          distributives: Distributive[];
          latestRelease: GithubRelease | null;
          latestReleaseError: string | null;
          updateAvailable: boolean;
          saves: GameSaveSummary | null;
          backups: BackupSummary;
          runtimeState: GameRuntimeState;
          savesStable: boolean;
      };
