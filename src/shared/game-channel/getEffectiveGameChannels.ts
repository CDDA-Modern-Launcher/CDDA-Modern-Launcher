import { GameChannelDefinition } from "./GameChannelDefinition";
import { BUILT_IN_GAME_CHANNELS } from "./BUILT_IN_GAME_CHANNELS";

export function getEffectiveGameChannels(customChannels: GameChannelDefinition[] = []): GameChannelDefinition[] {
    const customIds = new Set(customChannels.map((channel) => channel.id));
    return [...BUILT_IN_GAME_CHANNELS.filter((channel) => !customIds.has(channel.id)), ...customChannels];
}
