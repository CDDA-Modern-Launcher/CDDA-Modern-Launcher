import { GameChannelDefinition } from "./GameChannelDefinition";
import { DEFAULT_GAME_CHANNEL_ID } from "../Const";

export function findGameChannel(channels: GameChannelDefinition[], selectedChannelId: string): GameChannelDefinition {
    return channels.find((channel) => channel.id === selectedChannelId) ?? channels.find((channel) => channel.id === DEFAULT_GAME_CHANNEL_ID) ?? channels[0];
}
