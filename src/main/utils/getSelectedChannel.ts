import { RepositoryConfig } from "../../shared/RepositoryConfig";
import { GameChannelDefinition } from "../../shared/game-channel/GameChannelDefinition";
import { findGameChannel } from "../../shared/game-channel/findGameChannel";
import { getEffectiveGameChannels } from "../../shared/game-channel/getEffectiveGameChannels";
import { DEFAULT_GAME_CHANNEL_ID } from "../../shared/Const";

export function getSelectedChannel(config: RepositoryConfig): GameChannelDefinition {
    return findGameChannel(getEffectiveGameChannels(config.customGameChannels), config.selectedChannelId || DEFAULT_GAME_CHANNEL_ID);
}
