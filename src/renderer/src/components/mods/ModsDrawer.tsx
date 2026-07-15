import { ReactNode, useMemo } from "react";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useCloseDrawer, useIsDrawerOpened } from "@renderer/stores/useDrawerStore";
import { Drawer, Stack, Text } from "@mantine/core";
import { useSelectedGameChannel } from "@renderer/stores/useWorkspaceStore";
import { localizeChannelName } from "@renderer/utils/localizeChannelName";
import { compareMods } from "@renderer/utils/compareMods";
import { ModCard } from "@renderer/components/mods/ModCard";
import { useModsStore } from "@renderer/stores/useModsStore";
import { useShallow } from "zustand/react/shallow";
import { LocalizedText } from "@renderer/components/LocalizedText";
import { ModRepositoryState } from "../../../../shared/mods/ModRepositoryState";
import { ModDrawerTitle } from "@renderer/components/mods/ModDrawerTitle";

export function ModsDrawer(): ReactNode {
    const t = useTranslate();

    const close = useCloseDrawer();
    const isOpened = useIsDrawerOpened("mods");

    const selectedGameChannel = useSelectedGameChannel();
    const selectedGameChannelName = selectedGameChannel === null ? null : `${selectedGameChannel.gameName} · ${localizeChannelName(selectedGameChannel.channelName, t)}`;

    const { modRepoState, error } = useModsStore(
        useShallow((state) => ({
            modRepoState: state.state,
            error: state.error
        }))
    );
    const isRepositoryReady = modRepoState.status === "ready";

    const sortedMods = useMemo(() => [...modRepoState.mods].sort(compareMods), [modRepoState.mods]);

    return (
        <Drawer opened={isOpened} onClose={close} position="right" size={420} styles={{ title: { flex: 1 } }} title={<ModDrawerTitle />}>
            <Stack gap="md">
                {!!selectedGameChannelName && <LocalizedText size="xs" c="dimmed" i18nKey="content.sheet.mods.channel.hint" variables={{ channel: selectedGameChannelName }} />}

                <Stack gap="sm" className="content-sheet__intro">
                    <StateMessage isRepositoryReady={isRepositoryReady} state={modRepoState} />

                    {!!error && (
                        <Text size="sm" c="red">
                            {error}
                        </Text>
                    )}
                </Stack>

                <Stack gap="sm">{sortedMods.length === 0 ? <LocalizedText size="sm" c="dimmed" i18nKey="content.sheet.mods.empty" /> : sortedMods.map((mod) => <ModCard key={mod.id} mod={mod} />)}</Stack>
            </Stack>
        </Drawer>
    );
}

function StateMessage({ isRepositoryReady, state }: { isRepositoryReady: boolean; state: ModRepositoryState }): ReactNode {
    if (isRepositoryReady) return null;

    if (!state.message) return <LocalizedText size="sm" c="orange" i18nKey="content.sheet.context.unavailable" />;

    return (
        <Text size="sm" c="orange">
            {state.message}
        </Text>
    );
}
