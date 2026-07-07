import { ActionIcon, Divider, Drawer, Group, Loader, Stack, Text, Title, Tooltip } from "@mantine/core";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GithubRelease } from "../../../shared/GithubRelease";
import { GameBundleState } from "../../../shared/distributive/GameBundleState";
import { localizeChannelName } from "@renderer/utils/localizeChannelName";
import { DistributiveReleaseCard } from "@renderer/components/DistributiveReleaseCard";
import { InstallCard } from "@renderer/components/InstallCard";
import { GameBundle } from "../../../shared/distributive/GameBundle";
import { useTranslate } from "@renderer/localization/useLocaleStore";

interface Props {
    opened: boolean;
    state: GameBundleState;
    installedIds: Set<string>;
    isInstalling: boolean;
    onClose: () => void;
    onRefresh: () => Promise<void>;
    onRequestInstall: (release: GithubRelease) => void;
    onSetActive: (installId: string) => Promise<void>;
    onDelete: (distributive: GameBundle, deleteUserdata: boolean) => Promise<void>;
}

export function VersionsDrawer({ opened, state, installedIds, isInstalling, onClose, onRefresh, onRequestInstall, onSetActive, onDelete }: Props): React.JSX.Element {
    const t = useTranslate();
    const [releases, setReleases] = useState<GithubRelease[]>([]);
    const [isLoadingReleases, setLoadingReleases] = useState(false);
    const releaseById = useMemo(() => new Map(releases.map((release) => [release.id, release])), [releases]);
    const channelId = state.status === "ready" ? state.channel.id : "";

    const loadReleases = useCallback(async (forceRefresh = false): Promise<void> => {
        setLoadingReleases(true);
        try {
            setReleases(await window.api.game.getReleases(forceRefresh));
        } catch (error) {
            console.error("Failed to load releases", error);
        } finally {
            setLoadingReleases(false);
        }
    }, []);

    const refreshDrawer = async (): Promise<void> => {
        await Promise.all([onRefresh(), loadReleases(true)]);
    };

    useEffect(() => {
        if (!opened) return;
        queueMicrotask(() => void loadReleases());
    }, [opened, channelId, loadReleases]);

    return (
        <>
            <Drawer
                opened={opened}
                onClose={onClose}
                position="right"
                size={560}
                title={
                    <Group gap="xs" wrap="nowrap">
                        <Title order={3}>{t("versions.title")}</Title>
                        <Tooltip label={t("versions.action.refreshTooltip")}>
                            <ActionIcon variant="subtle" aria-label={t("versions.action.refreshTooltip")} loading={isLoadingReleases} onClick={() => void refreshDrawer()}>
                                ↻
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                }
            >
                <Stack gap="lg">
                    <Text size="sm" c="dimmed">
                        {state.status === "ready" ? t("versions.description", { channel: `${state.channel.shortName} · ${localizeChannelName(state.channel.channelName, t)}` }) : t("versions.description.unavailable")}
                    </Text>
                    <Stack gap="sm">
                        <Title order={4}>{t("versions.installed.title")}</Title>
                        {state.status !== "ready" || state.gameBundles.length === 0 ? (
                            <Text size="sm" c="dimmed">
                                {t("versions.installed.empty")}
                            </Text>
                        ) : (
                            state.gameBundles.map((dis) => <InstallCard key={dis.id} distributive={dis} release={releaseById.get(dis.id) ?? null} onSetActive={onSetActive} onConfirmDelete={onDelete} />)
                        )}
                    </Stack>
                    <Divider />
                    <Stack gap="sm">
                        <Group justify="space-between">
                            <Title order={4}>{t("versions.available.title")}</Title>
                            {isLoadingReleases && <Loader size="sm" />}
                        </Group>
                        <Stack gap="sm">
                            {releases.length === 0 && !isLoadingReleases ? (
                                <Text size="sm" c="dimmed">
                                    {t("versions.available.empty")}
                                </Text>
                            ) : (
                                releases.map((release) => (
                                    <DistributiveReleaseCard key={release.id} release={release} isInstalled={installedIds.has(release.id)} isInstalling={isInstalling} onRequestInstall={onRequestInstall} />
                                ))
                            )}
                        </Stack>
                    </Stack>
                </Stack>
            </Drawer>
        </>
    );
}
