import { ReactNode, useCallback, useMemo } from "react";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useDrawerStore, useIsDrawerOpened } from "@renderer/stores/useDrawerStore";
import { ActionIcon, Drawer, Group, Menu, Stack, Text, Title, Tooltip } from "@mantine/core";
import { useWorkspaceStore } from "@renderer/stores/useWorkspaceStore";
import { findGameChannel } from "../../../shared/game-channel/findGameChannel";
import { getEffectiveGameChannels } from "../../../shared/game-channel/getEffectiveGameChannels";
import { localizeChannelName } from "@renderer/utils/localizeChannelName";
import { compareMods } from "@renderer/utils/compareMods";
import { ContentSection } from "@renderer/components/ContentSection";
import { ModCard } from "@renderer/components/ModCard";
import { useModsStore } from "@renderer/stores/useModsStore";
import { useShallow } from "zustand/react/shallow";
import { openModal } from "@renderer/modals/contextModals";

export function ModsDrawer(): ReactNode {
    const t = useTranslate();

    const close = useDrawerStore((state) => state.close);
    const isOpened = useIsDrawerOpened("mods");

    const ws = useWorkspaceStore((state) => state.workspaceStatus);
    const channel = ws.status === "ready" ? findGameChannel(getEffectiveGameChannels(ws.config.customGameChannels), ws.config.selectedChannelId) : null;
    const channelName = channel === null ? null : `${channel.gameName} · ${localizeChannelName(channel.channelName, t)}`;

    const { state, checkUpdates, busyAction, error } = useModsStore(
        useShallow((state) => ({
            state: state.state,
            checkUpdates: state.checkUpdates,
            busyAction: state.busyAction,
            error: state.error
        }))
    );

    const sortedMods = useMemo(() => [...state.mods].sort(compareMods), [state.mods]);

    const isRepositoryReady = ws.status === "ready" && state.status === "ready";

    const handleAddGitMod = useCallback(() => openModal("addModFromGit", t("contentSheet.mods.gitModal.title"), {}), [t]);

    return (
        <Drawer opened={isOpened} onClose={close} position="right" size={420} title={<Title order={3}>{t("contentSheet.mods.title")}</Title>}>
            <Stack gap="xl">
                <Stack gap="sm" className="content-sheet__intro">
                    <Text size="sm" c="dimmed">
                        {channelName === null ? t("contentSheet.mods.channelHintUnavailable") : t("contentSheet.mods.channelHint", { channel: channelName })}
                    </Text>
                    {!isRepositoryReady && (
                        <Text size="sm" c="orange">
                            {state.message ?? t("contentSheet.context.unavailable")}
                        </Text>
                    )}
                    {!!error && (
                        <Text size="sm" c="red">
                            {error}
                        </Text>
                    )}
                </Stack>

                <ContentSection
                    title={t("contentSheet.mods.installed.title")}
                    actions={
                        <Group gap="xs" wrap="nowrap">
                            <Menu shadow="md" width={260} position="bottom-end" disabled={!isRepositoryReady || busyAction !== null}>
                                <Menu.Target>
                                    <Tooltip label={t("contentSheet.mods.add.tooltip")} position="top">
                                        <ActionIcon variant="light" radius="md" disabled={!isRepositoryReady || busyAction !== null} aria-label={t("contentSheet.mods.add.tooltip")}>
                                            +
                                        </ActionIcon>
                                    </Tooltip>
                                </Menu.Target>
                                <Menu.Dropdown>
                                    <Menu.Label>{t("contentSheet.mods.add.menuTitle")}</Menu.Label>
                                    <Menu.Item onClick={handleAddGitMod}>{t("contentSheet.mods.add.fromGit")}</Menu.Item>
                                    <Menu.Item disabled>{t("contentSheet.mods.add.fromFolder")}</Menu.Item>
                                    <Menu.Item disabled>{t("contentSheet.mods.add.fromArchive")}</Menu.Item>
                                </Menu.Dropdown>
                            </Menu>
                            <Tooltip label={t("contentSheet.mods.check.button")} position="top">
                                <ActionIcon
                                    variant="subtle"
                                    radius="md"
                                    onClick={checkUpdates}
                                    disabled={!isRepositoryReady || busyAction !== null}
                                    loading={busyAction === "check-updates" || state.checking}
                                    aria-label={t("contentSheet.mods.check.button")}
                                >
                                    ↻
                                </ActionIcon>
                            </Tooltip>
                        </Group>
                    }
                >
                    {sortedMods.length === 0 ? (
                        <Text size="sm" c="dimmed">
                            {t("contentSheet.mods.empty")}
                        </Text>
                    ) : (
                        sortedMods.map((mod) => <ModCard key={mod.id} mod={mod} />)
                    )}
                </ContentSection>
            </Stack>
        </Drawer>
    );
}
