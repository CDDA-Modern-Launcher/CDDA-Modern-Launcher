import { Button, Group, Menu, Paper, Text, Tooltip } from "@mantine/core";
import React, { useEffect, useState } from "react";

import { findGameChannel, getEffectiveGameChannels } from "../../../../shared/gameChannels";
import { GameInstallProgress } from "../../../../shared/gameInstallations";
import { RepositoryStatus } from "../../../../shared/repository";
import { useLocalization } from "../../localization/LocalizationContext";

type LauncherDockProps = {
    repository: RepositoryStatus;
    onSelectChannel: (channelId: string) => Promise<void>;
    onOpenSettings: () => void;
    onOpenMods: () => void;
    onOpenSoundpack: () => void;
    onOpenTileset: () => void;
};

export function LauncherDock({ repository, onSelectChannel, onOpenSettings, onOpenMods, onOpenSoundpack, onOpenTileset }: LauncherDockProps): React.JSX.Element {
    const { t } = useLocalization();
    const isReady = repository.status === "ready";
    const channels = isReady ? getEffectiveGameChannels(repository.config.customChannels) : [];
    const selectedChannel = isReady ? findGameChannel(channels, repository.config.selectedChannelId) : null;
    const [installProgress, setInstallProgress] = useState<GameInstallProgress>({ status: "idle" });
    const isInstallingGame = isInstallBlockingProgress(installProgress);

    useEffect(() => window.api.game.onInstallProgress(setInstallProgress), []);

    return (
        <Paper withBorder radius="lg" shadow="xl" className="launcher-dock">
            <Group justify="space-between" gap="md" wrap="nowrap">
                <Group gap="xs" wrap="nowrap" className="launcher-dock__section">
                    <Menu shadow="md" width={310} position="top-start" disabled={!isReady || isInstallingGame}>
                        <Menu.Target>
                            <Button variant="subtle" size="xs" radius="md" disabled={!isReady || isInstallingGame} className="launcher-dock__button launcher-dock__game-button">
                                {selectedChannel === null ? t("dock.game.unavailable") : `${selectedChannel.shortName} · ${selectedChannel.channelName}`}
                            </Button>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Label>{t("dock.game.menuTitle")}</Menu.Label>
                            {channels.map((channel) => (
                                <Menu.Item
                                    key={channel.id}
                                    onClick={() => {
                                        onSelectChannel(channel.id).catch((error) => console.error("Failed to select game channel", error));
                                    }}
                                    rightSection={channel.id === selectedChannel?.id ? "✓" : undefined}
                                >
                                    <StackedMenuLabel title={`${channel.shortName} · ${channel.channelName}`} description={`${channel.githubOwner}/${channel.githubRepo}`} />
                                </Menu.Item>
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
                    <Button variant="light" size="xs" radius="md" onClick={onOpenMods} className="launcher-dock__button">
                        {t("dock.mods")}
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

function isInstallBlockingProgress(progress: GameInstallProgress): boolean {
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

function getDockStatusText(t: (key: string) => string, repository: RepositoryStatus): string {
    if (repository.status === "ready") {
        return t("dock.status.uiOnly");
    }

    if (repository.status === "invalid") {
        return t("dock.status.repositoryInvalid");
    }

    return t("dock.status.repositoryMissing");
}

function getDockStatusTooltip(t: (key: string) => string, repository: RepositoryStatus): string {
    if (repository.status === "ready") {
        return t("dock.status.tooltip.uiOnly");
    }

    if (repository.status === "invalid") {
        return repository.message;
    }

    return t("dock.status.tooltip.repositoryMissing");
}

function getDockStatusDotClassName(repository: RepositoryStatus): string {
    const modifier = repository.status === "ready" ? "draft" : repository.status === "invalid" ? "error" : "missing";
    return `launcher-dock__status-dot launcher-dock__status-dot--${modifier}`;
}
