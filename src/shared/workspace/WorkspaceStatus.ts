import { WorkspaceConfig } from "../WorkspaceConfig";
import { GameChannelDefinition } from "../game-channel/GameChannelDefinition";

export type ReadyWorkspaceStatus = {
    status: "ready";
    path: string;
    config: WorkspaceConfig;
    gameChannels: GameChannelDefinition[];
    selectedGameChannel: GameChannelDefinition;
};

export type WorkspaceStatus = { status: "unconfigured" } | { status: "loading"; path: string } | ReadyWorkspaceStatus | { status: "invalid"; path: string; message: string };
