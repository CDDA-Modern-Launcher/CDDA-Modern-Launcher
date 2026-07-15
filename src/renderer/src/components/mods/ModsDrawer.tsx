import { ReactNode, useCallback, useMemo } from "react";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useCloseDrawer, useIsDrawerOpened } from "@renderer/stores/useDrawerStore";
import { ActionIcon, Drawer, Group, Menu, Stack, Text, Title, Tooltip } from "@mantine/core";
import { useSelectedGameChannel } from "@renderer/stores/useWorkspaceStore";
import { localizeChannelName } from "@renderer/utils/localizeChannelName";
import { compareMods } from "@renderer/utils/compareMods";
import { ModCard } from "@renderer/components/ModCard";
import { useModsStore } from "@renderer/stores/useModsStore";
import { useShallow } from "zustand/react/shallow";
import { openModal } from "@renderer/modals/contextModals";
import { LocalizedText } from "@renderer/components/LocalizedText";
import { ModRepositoryState } from "../../../../shared/mods/ModRepositoryState";
import { IconPlus, IconQuestionMark, IconRefresh } from "@tabler/icons-react";
import { defaultIconProps } from "@renderer/utils/defaultIconProps";

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

function ModDrawerTitle(): ReactNode {
    const t = useTranslate();
    const handleAddGitMod = useCallback(() => openModal("addModFromGit", t("content.sheet.mods.git.modal.title"), {}), [t]);
    const { modRepoState, checkUpdates, busyAction } = useModsStore(
        useShallow((state) => ({
            modRepoState: state.state,
            checkUpdates: state.checkUpdates,
            busyAction: state.busyAction
        }))
    );
    const isRepositoryReady = modRepoState.status === "ready";
    const isBusy = !isRepositoryReady || busyAction !== null;
    const isLoading = busyAction === "check-updates" || modRepoState.checking;

    const handleHelpClick = useCallback(() => {
        // todo open modal with detailed help and info
    }, []);

    return (
        <Group gap="md" justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap">
                <Title order={3}>{t("content.sheet.mods.title")}</Title>

                <ActionIcon variant="gradient" color="red" size="sm" radius="xl" style={{ marginBottom: -4 }} aria-label="Hint" onClick={handleHelpClick}>
                    <IconQuestionMark size={14} stroke={2.5} />
                </ActionIcon>
            </Group>

            <Group gap="xs" wrap="nowrap">
                <Menu shadow="md" width={260} position="bottom-end" disabled={isBusy}>
                    <Menu.Target>
                        <Tooltip label={t("content.sheet.mods.add.tooltip")} position="top">
                            <ActionIcon variant="light" radius="md" disabled={isBusy} aria-label={t("content.sheet.mods.add.tooltip")}>
                                <IconPlus {...defaultIconProps} />
                            </ActionIcon>
                        </Tooltip>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Label>{t("content.sheet.mods.add.menu.title")}</Menu.Label>
                        <Menu.Item onClick={handleAddGitMod}>{t("content.sheet.mods.add.from.git")}</Menu.Item>
                        <Menu.Item disabled>{t("content.sheet.mods.add.from.folder")}</Menu.Item>
                        <Menu.Item disabled>{t("content.sheet.mods.add.from.archive")}</Menu.Item>
                    </Menu.Dropdown>
                </Menu>

                <Tooltip label={t("content.sheet.mods.check.button")} position="top">
                    <ActionIcon variant="subtle" radius="md" onClick={checkUpdates} disabled={isBusy} loading={isLoading} aria-label={t("content.sheet.mods.check.button")}>
                        <IconRefresh {...defaultIconProps} />
                    </ActionIcon>
                </Tooltip>
            </Group>
        </Group>
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
