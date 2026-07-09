import { ActionIcon, Divider, Drawer, Group, Loader, Stack, Title, Tooltip } from "@mantine/core";
import React, { useEffect, useMemo } from "react";
import { GithubRelease } from "../../../shared/GithubRelease";
import { localizeChannelName } from "@renderer/utils/localizeChannelName";
import { GameBundleReleaseCard } from "@renderer/components/GameBundleReleaseCard";
import { GameBundleCard } from "@renderer/components/GameBundleCard";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useCloseDrawer, useIsDrawerOpened } from "@renderer/stores/useDrawerStore";
import { useGameStateStore } from "@renderer/stores/useGameStateStore";
import { useGameReleasesStore } from "@renderer/stores/useGameReleasesStore";
import { useGameBundleInstallStore } from "@renderer/stores/useGameBundleInstallStore";
import { useGameFileOperationStore } from "@renderer/stores/useGameFileOperationStore";
import { openModal } from "@renderer/modals/contextModals";
import { LocalizedText } from "@renderer/components/LocalizedText";

export function GameBundlesDrawer(): React.JSX.Element {
    const t = useTranslate();

    const close = useCloseDrawer();
    const isOpened = useIsDrawerOpened("game-bundles");

    const gameState = useGameStateStore((state) => state.state);
    const availableReleases = useGameReleasesStore((state) => state.releases);
    const isLoadingReleases = useGameReleasesStore((state) => state.isLoading);
    const isInstallingGameBundle = useGameBundleInstallStore((state) => state.isInstalling);
    const fileOperationRunning = useGameFileOperationStore((state) => state.isRunning);
    const refreshGame = useGameStateStore((state) => state.refresh);
    const loadReleases = useGameReleasesStore((state) => state.load);
    const setActiveGameBundle = useGameBundleInstallStore((state) => state.setActive);
    const hasInstalledVersions = gameState.status === "ready" && gameState.gameBundles.length > 0;
    const openInstallModal = (release: GithubRelease | null): void => {
        if (release === null) return;
        openModal("installRelease", t("home.action.install.update"), { release, hasInstalledVersions });
    };

    const gameBundleIds = useMemo(() => new Set(gameState.status === "ready" ? gameState.gameBundles.map((gameBundle) => gameBundle.id) : []), [gameState]);
    const releaseById = useMemo(() => new Map(availableReleases.map((release) => [release.id, release])), [availableReleases]);
    const gameChannelId = gameState.status === "ready" ? gameState.channel.id : "";
    const refreshVersions = async (): Promise<void> => {
        await Promise.all([refreshGame(true, true), loadReleases(true)]);
    };

    useEffect(() => {
        if (!isOpened) return;
        queueMicrotask(() => void loadReleases());
    }, [isOpened, gameChannelId, loadReleases]);

    return (
        <Drawer
            opened={isOpened}
            onClose={close}
            position="right"
            size={560}
            title={
                <Group gap="xs" wrap="nowrap">
                    <Title order={3}>{t("versions.title")}</Title>
                    <Tooltip label={t("versions.action.refresh.tooltip")}>
                        <ActionIcon variant="subtle" aria-label={t("versions.action.refresh.tooltip")} loading={isLoadingReleases} disabled={fileOperationRunning} onClick={refreshVersions}>
                            ↻
                        </ActionIcon>
                    </Tooltip>
                </Group>
            }
        >
            <Stack gap="lg">
                {gameState.status === "ready" ? (
                    <LocalizedText size="sm" c="dimmed" i18nKey="versions.description" variables={{ channel: `${gameState.channel.shortName} · ${localizeChannelName(gameState.channel.channelName, t)}` }} />
                ) : (
                    <LocalizedText size="sm" c="dimmed" i18nKey="versions.description.unavailable" />
                )}
                <Stack gap="sm">
                    <Title order={4}>{t("versions.installed.title")}</Title>
                    {gameState.status !== "ready" || gameState.gameBundles.length === 0 ? (
                        <LocalizedText size="sm" c="dimmed" i18nKey="versions.installed.empty" />
                    ) : (
                        gameState.gameBundles.map((gameBundle) => (
                            <GameBundleCard
                                key={gameBundle.id}
                                gameBundle={gameBundle}
                                release={releaseById.get(gameBundle.id) ?? null}
                                onSetActive={async (gameBundleId) => await setActiveGameBundle(gameBundleId)}
                                actionDisabled={fileOperationRunning}
                            />
                        ))
                    )}
                </Stack>
                <Divider />
                <Stack gap="sm">
                    <Group justify="space-between">
                        <Title order={4}>{t("versions.available.title")}</Title>
                        {isLoadingReleases && <Loader size="sm" />}
                    </Group>
                    <Stack gap="sm">
                        {availableReleases.length === 0 && !isLoadingReleases ? (
                            <LocalizedText size="sm" c="dimmed" i18nKey="versions.available.empty" />
                        ) : (
                            availableReleases.map((release) => (
                                <GameBundleReleaseCard
                                    key={release.id}
                                    release={release}
                                    isGameBundleReady={gameBundleIds.has(release.id)}
                                    isInstallingGameBundle={isInstallingGameBundle}
                                    actionDisabled={fileOperationRunning}
                                    onRequestInstall={openInstallModal}
                                />
                            ))
                        )}
                    </Stack>
                </Stack>
            </Stack>
        </Drawer>
    );
}
