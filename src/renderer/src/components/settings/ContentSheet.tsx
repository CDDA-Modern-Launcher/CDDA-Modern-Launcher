import { Drawer, Title } from "@mantine/core";
import type React from "react";

import { localizeChannelName } from "../../localization/channelLabels";
import { useLocalization } from "../../localization/LocalizationContext";
import { WorkspaceStatus } from "../../../../shared/workspace/WorkspaceStatus";
import { getEffectiveGameChannels } from "../../../../shared/game-channel/getEffectiveGameChannels";
import { findGameChannel } from "../../../../shared/game-channel/findGameChannel";
import { PlaceholderContent } from "@renderer/components/settings/content/PlaceholderContent";
import { ModsContent } from "@renderer/components/settings/ModsContent";
import { TContentSheetKind } from "@renderer/types/TContentSheetKind";

const contentTitleKeyByKind: Record<TContentSheetKind, string> = {
    mods: "contentSheet.mods.title",
    soundpack: "contentSheet.soundpack.title",
    tileset: "contentSheet.tileset.title"
};

type ContentSheetProps = {
    repository: WorkspaceStatus;
    kind: TContentSheetKind | null;
    onClose: () => void;
};

export function ContentSheet({ repository, kind, onClose }: ContentSheetProps): React.JSX.Element {
    const { t } = useLocalization();
    const opened = kind !== null;
    const effectiveKind = kind ?? "mods";
    const selectedChannel = repository.status === "ready" ? findGameChannel(getEffectiveGameChannels(repository.config.customGameChannels), repository.config.selectedChannelId) : null;
    const selectedChannelName = selectedChannel === null ? null : `${selectedChannel.gameName} · ${localizeChannelName(selectedChannel.channelName, t)}`;

    return (
        <Drawer opened={opened} onClose={onClose} position="right" size={520} title={<Title order={3}>{t(contentTitleKeyByKind[effectiveKind])}</Title>}>
            {effectiveKind === "mods" ? <ModsContent repository={repository} selectedChannelName={selectedChannelName} /> : <PlaceholderContent kind={effectiveKind} selectedChannelName={selectedChannelName} />}
        </Drawer>
    );
}
