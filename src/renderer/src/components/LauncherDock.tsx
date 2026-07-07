import { Button, Group, Menu, Paper, Text, Tooltip } from "@mantine/core";
import React, { useCallback, useEffect, useState } from "react";

import { useLocalization } from "../localization/LocalizationContext";
import { WorkspaceStatus } from "../../../shared/workspace/WorkspaceStatus";
import { getEffectiveGameChannels } from "../../../shared/game-channel/getEffectiveGameChannels";
import { findGameChannel } from "../../../shared/game-channel/findGameChannel";
import { InstallDistributiveProgress } from "../../../shared/distributive/InstallDistributiveProgress";
import { ModRepositoryState } from "../../../shared/mods/ModRepositoryState";
import { localizeChannelName } from "@renderer/utils/localizeChannelName";
import { GameChannelDefinition } from "../../../shared/game-channel/GameChannelDefinition";
import { useWorkspaceStore } from "@renderer/stores/useWorkspaceStore";

type LauncherDockProps = {
    onOpenSettings: () => void;
    onOpenMods: () => void;
    onOpenSoundpack: () => void;
    onOpenTileset: () => void;
};

export function LauncherDock({ onOpenSettings, onOpenMods, onOpenSoundpack, onOpenTileset }: LauncherDockProps): React.JSX.Element {
    const { t } = useLocalization();
    const repository = useWorkspaceStore((state) => state.workspaceStatus);
    const isReady = repository.status === "ready";
    const channels = isReady ? getEffectiveGameChannels(repository.config.customGameChannels) : [];
    const selectedChannel = isReady ? findGameChannel(channels, repository.config.selectedChannelId) : null;
    const [installProgress, setInstallProgress] = useState<InstallDistributiveProgress>({ status: "idle" });
    const [modRepositoryState, setModRepositoryState] = useState<ModRepositoryState>({ status: "unconfigured", mods: [], checking: false });
    const isInstallingGame = isInstallBlockingProgress(installProgress);
    const modIndicatorState = getModIndicatorState(modRepositoryState);

    useEffect(() => window.api.game.onInstallProgress(setInstallProgress), []);

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
                    <Menu shadow="md" width={310} position="top-start" disabled={!isReady || isInstallingGame}>
                        <Menu.Target>
                            <Button variant="subtle" size="xs" radius="md" disabled={!isReady || isInstallingGame} className="launcher-dock__button launcher-dock__game-button">
                                {selectedChannel === null ? t("dock.game.unavailable") : `${selectedChannel.shortName} · ${localizeChannelName(selectedChannel.channelName, t)}`}
                            </Button>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Label>{t("dock.game.menuTitle")}</Menu.Label>
                            {channels.map((channel) => (
                                <ItemView channel={channel} selectedChannel={selectedChannel} key={channel.id} />
                            ))}
                            <Menu.Divider />
                            <Menu.Item disabled>{t("dock.game.addCustom")}</Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                    <Tooltip label={getDockStatusTooltip(t, repository)} position="top">
                        <Text size="xs" c="dimmed" className="launcher-dock__status">
                            <span className={getDockStatusDotClassName(repository)} />
                            {getDockStatusText(t, repository)}
                        </Text>
                    </Tooltip>
                </Group>

                <Group gap="xs" wrap="nowrap" className="launcher-dock__section launcher-dock__section--right">
                    <Button variant="light" size="xs" radius="md" onClick={onOpenTileset} className="launcher-dock__button">
                        {t("dock.tileset")}
                    </Button>
                    <Button variant="light" size="xs" radius="md" onClick={onOpenSoundpack} className="launcher-dock__button">
                        {t("dock.soundpack")}
                    </Button>
                    <Button variant="light" size="xs" radius="md" onClick={onOpenMods} className="launcher-dock__button launcher-dock__mods-button">
                        {t("dock.mods")}
                        {modIndicatorState !== "idle" && <span className={`launcher-dock__mods-indicator launcher-dock__mods-indicator--${modIndicatorState}`} aria-hidden="true" />}
                    </Button>

                    <Tooltip label={t("dock.settings.tooltip")} position="top">
                        <Button variant="filled" size="xs" radius="md" onClick={onOpenSettings} className="launcher-dock__settings-button">
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
    const { t } = useLocalization();

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

function isInstallBlockingProgress(progress: InstallDistributiveProgress): boolean {
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

function getDockStatusText(t: (key: string) => string, repository: WorkspaceStatus): string {
    if (repository.status === "ready") {
        return t("dock.status.uiOnly");
    }

    if (repository.status === "invalid") {
        return t("dock.status.repositoryInvalid");
    }

    return t("dock.status.repositoryMissing");
}

function getDockStatusTooltip(t: (key: string) => string, repository: WorkspaceStatus): string {
    if (repository.status === "ready") {
        return t("dock.status.tooltip.uiOnly");
    }

    if (repository.status === "invalid") {
        return repository.message;
    }

    return t("dock.status.tooltip.repositoryMissing");
}

function getDockStatusDotClassName(repository: WorkspaceStatus): string {
    const modifier = repository.status === "ready" ? "draft" : repository.status === "invalid" ? "error" : "missing";
    return `launcher-dock__status-dot launcher-dock__status-dot--${modifier}`;
}

function getModIndicatorState(state: ModRepositoryState): "idle" | "checking" | "updates" {
    if (state.status !== "ready") {
        return "idle";
    }

    if (state.mods.some((mod) => mod.updateAvailable)) {
        return "updates";
    }

    if (state.checking) {
        return "checking";
    }

    return "idle";
}
