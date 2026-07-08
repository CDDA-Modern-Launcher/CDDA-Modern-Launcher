import { Button, Group, Menu, Paper, Text, Tooltip } from "@mantine/core";
import React, { ReactNode, useCallback, useEffect, useState } from "react";
import { getEffectiveGameChannels } from "../../../shared/game-channel/getEffectiveGameChannels";
import { findGameChannel } from "../../../shared/game-channel/findGameChannel";
import { GameBundleInstallProgress } from "../../../shared/game-bundle/GameBundleInstallProgress";
import { ModRepositoryState } from "../../../shared/mods/ModRepositoryState";
import { localizeChannelName } from "@renderer/utils/localizeChannelName";
import { GameChannelDefinition } from "../../../shared/game-channel/GameChannelDefinition";
import { useWorkspaceStore } from "@renderer/stores/useWorkspaceStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useOpenDrawerSimple } from "@renderer/stores/useDrawerStore";
import { useConfigStore } from "@renderer/stores/useConfigStore";

export function AppBottomDock(): ReactNode {
    const t = useTranslate();
    const repository = useWorkspaceStore((state) => state.workspaceStatus);
    const isReady = repository.status === "ready";
    const channels = isReady ? getEffectiveGameChannels(repository.config.customGameChannels) : [];
    const selectedChannel = isReady ? findGameChannel(channels, repository.config.selectedChannelId) : null;
    const [gameBundleInstallProgress, setGameBundleInstallProgress] = useState<GameBundleInstallProgress>({ status: "idle" });
    const [modRepositoryState, setModRepositoryState] = useState<ModRepositoryState>({ status: "unconfigured", mods: [], checking: false });
    const isGameBundleInstallInProgress = isGameBundleInstallBlockingProgress(gameBundleInstallProgress);
    const modIndicatorState = getModIndicatorState(modRepositoryState);
    const openDrawer = useOpenDrawerSimple();
    const backupsEnabled = useConfigStore((state) => state.backupsEnabled);

    useEffect(() => window.api.game.onGameBundleInstallProgress(setGameBundleInstallProgress), []);

    useEffect(() => {
        let mounted = true;

        window.api.mods
            .getState()
            .then((state) => {
                if (mounted) {
                    setModRepositoryState(state);
                }
            })
            .catch((error) => console.error("Failed to load mods state for dock", error));

        const unsubscribeChanged = window.api.mods.onChanged((event) => {
            setModRepositoryState(event.state);
        });
        const unsubscribeNotice = window.api.mods.onNotice((event) => {
            setModRepositoryState(event.state);
        });

        return () => {
            mounted = false;
            unsubscribeChanged();
            unsubscribeNotice();
        };
    }, [repository]);

    return (
        <Paper withBorder radius="lg" shadow="xl" className="launcher-dock">
            <Group justify="space-between" gap="md" wrap="nowrap">
                <Group gap="xs" wrap="nowrap" className="launcher-dock__section">
                    <Menu shadow="md" width={310} position="top-start" disabled={!isReady || isGameBundleInstallInProgress}>
                        <Menu.Target>
                            <Button variant="gradient" size="xs" radius="md" disabled={!isReady || isGameBundleInstallInProgress} className="launcher-dock__button launcher-dock__game-button">
                                {selectedChannel === null ? t("dock.game.unavailable") : `${selectedChannel.shortName} · ${localizeChannelName(selectedChannel.channelName, t)}`}
                            </Button>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Label>{t("dock.game.menu.title")}</Menu.Label>
                            {channels.map((channel) => (
                                <ItemView channel={channel} selectedChannel={selectedChannel} key={channel.id} />
                            ))}
                            <Menu.Divider />
                            <Menu.Item disabled>{t("dock.game.add.custom")}</Menu.Item>
                        </Menu.Dropdown>
                    </Menu>

                    <Button size="xs" variant="light" onClick={() => openDrawer("game-bundles")}>
                        {t("versions.title")}
                    </Button>
                </Group>

                <Group gap="xs" wrap="nowrap" className="launcher-dock__section launcher-dock__section--right">
                    {backupsEnabled && (
                        <Button size="xs" variant="light" onClick={() => openDrawer("backups")}>
                            {t("backup.action.manage")}
                        </Button>
                    )}

                    <Button variant="light" size="xs" radius="md" onClick={() => openDrawer("mods")} className="launcher-dock__button launcher-dock__mods-button">
                        {t("dock.mods")}
                        {modIndicatorState !== "idle" && <span className={`launcher-dock__mods-indicator launcher-dock__mods-indicator--${modIndicatorState}`} aria-hidden="true" />}
                    </Button>

                    <Tooltip label={t("dock.settings.tooltip")} position="top">
                        <Button variant="filled" size="xs" radius="md" onClick={() => openDrawer("settings")} className="launcher-dock__settings-button">
                            <span className="launcher-dock__settings-icon" aria-hidden="true">
                                ⚙
                            </span>
                            {t("dock.settings")}
                        </Button>
                    </Tooltip>
                </Group>
            </Group>
        </Paper>
    );
}

function ItemView({ channel, selectedChannel }: { channel: GameChannelDefinition; selectedChannel: GameChannelDefinition | null }): React.JSX.Element {
    const t = useTranslate();

    const onSelectChannel = useWorkspaceStore((state) => state.setSelectedChannel);

    const handleClick = useCallback(() => {
        onSelectChannel(channel.id).catch((error) => console.error("Failed to select game channel", error));
    }, [channel.id, onSelectChannel]);

    return (
        <Menu.Item key={channel.id} onClick={handleClick} rightSection={channel.id === selectedChannel?.id ? "✓" : undefined}>
            <StackedMenuLabel title={`${channel.shortName} · ${localizeChannelName(channel.channelName, t)}`} description={`${channel.githubOwner}/${channel.githubRepo}`} />
        </Menu.Item>
    );
}

function isGameBundleInstallBlockingProgress(progress: GameBundleInstallProgress): boolean {
    return progress.status === "resolving-release" || progress.status === "downloading" || progress.status === "extracting" || progress.status === "preparing-saves" || progress.status === "finalizing";
}

function StackedMenuLabel({ title, description }: { title: string; description: string }): React.JSX.Element {
    return (
        <span className="launcher-dock__menu-label">
            <Text size="sm">{title}</Text>
            <Text size="xs" c="dimmed">
                {description}
            </Text>
        </span>
    );
}

function getModIndicatorState(state: ModRepositoryState): "idle" | "checking" | "updates" {
    if (state.status !== "ready") return "idle";
    if (state.mods.some((mod) => mod.updateAvailable)) return "updates";
    if (state.checking) return "checking";
    return "idle";
}
