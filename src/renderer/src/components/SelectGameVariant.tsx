import React, { useCallback } from "react";
import { Button, Menu, Text } from "@mantine/core";
import { localizeChannelName } from "@renderer/utils/localizeChannelName";
import { useGameChannels, useSelectedGameChannel, useWorkspaceStore } from "@renderer/stores/useWorkspaceStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { GameBundleInstallProgress } from "../../../shared/game-bundle/GameBundleInstallProgress";
import { useGameBundleInstallStore } from "@renderer/stores/useGameBundleInstallStore";
import { GameChannelDefinition } from "../../../shared/game-channel/GameChannelDefinition";

export function SelectGameVariant(): React.JSX.Element {
    const t = useTranslate();
    const workspace = useWorkspaceStore((state) => state.workspaceStatus);
    const isReady = workspace.status === "ready";
    const channels = useGameChannels();
    const selectedChannel = useSelectedGameChannel();
    const gameBundleInstallProgress = useGameBundleInstallStore((state) => state.progress);
    const isGameBundleInstallInProgress = isGameBundleInstallBlockingProgress(gameBundleInstallProgress);

    return (
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
    );
}

function isGameBundleInstallBlockingProgress(progress: GameBundleInstallProgress): boolean {
    return progress.status === "resolving-release" || progress.status === "downloading" || progress.status === "extracting" || progress.status === "preparing-saves" || progress.status === "finalizing";
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
