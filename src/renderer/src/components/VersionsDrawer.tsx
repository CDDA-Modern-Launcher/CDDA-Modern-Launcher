import { ActionIcon, Divider, Drawer, Group, Loader, Stack, Text, Title, Tooltip } from "@mantine/core";
import type React from "react";
import { useMemo } from "react";
import { GithubRelease } from "../../../shared/GithubRelease";
import { GameBundleState } from "../../../shared/game-bundle/GameBundleState";
import { localizeChannelName } from "@renderer/utils/localizeChannelName";
import { GameBundleReleaseCard } from "@renderer/components/GameBundleReleaseCard";
import { GameBundleCard } from "@renderer/components/GameBundleCard";
import { GameBundle } from "../../../shared/game-bundle/GameBundle";
import { useTranslate } from "@renderer/localization/useLocaleStore";

interface Props {
    opened: boolean;
    state: GameBundleState;
    gameBundleIds: Set<string>;
    releases: GithubRelease[];
    isLoadingReleases: boolean;
    isInstallingGameBundle: boolean;
    actionDisabled: boolean;
    onClose: () => void;
    onRefresh: () => Promise<void>;
    onRequestInstall: (release: GithubRelease) => void;
    onSetActive: (gameBundleId: string) => Promise<boolean>;
    onDelete: (gameBundle: GameBundle, deleteUserdata: boolean) => Promise<boolean>;
}

export function VersionsDrawer({
    opened,
    state,
    gameBundleIds,
    releases,
    isLoadingReleases,
    isInstallingGameBundle,
    actionDisabled,
    onClose,
    onRefresh,
    onRequestInstall,
    onSetActive,
    onDelete
}: Props): React.JSX.Element {
    const t = useTranslate();
    const releaseById = useMemo(() => new Map(releases.map((release) => [release.id, release])), [releases]);

    return (
        <Drawer
            opened={opened}
            onClose={onClose}
            position="right"
            size={560}
            title={
                <Group gap="xs" wrap="nowrap">
                    <Title order={3}>{t("versions.title")}</Title>
                    <Tooltip label={t("versions.action.refreshTooltip")}>
                        <ActionIcon variant="subtle" aria-label={t("versions.action.refreshTooltip")} loading={isLoadingReleases} disabled={actionDisabled} onClick={() => void onRefresh()}>
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
                        state.gameBundles.map((gameBundle) => (
                            <GameBundleCard
                                key={gameBundle.id}
                                gameBundle={gameBundle}
                                release={releaseById.get(gameBundle.id) ?? null}
                                onSetActive={async (gameBundleId) => {
                                    await onSetActive(gameBundleId);
                                }}
                                actionDisabled={actionDisabled}
                                onConfirmDelete={(gameBundle, deleteUserdata) => void onDelete(gameBundle, deleteUserdata)}
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
                        {releases.length === 0 && !isLoadingReleases ? (
                            <Text size="sm" c="dimmed">
                                {t("versions.available.empty")}
                            </Text>
                        ) : (
                            releases.map((release) => (
                                <GameBundleReleaseCard
                                    key={release.id}
                                    release={release}
                                    isGameBundleReady={gameBundleIds.has(release.id)}
                                    isInstallingGameBundle={isInstallingGameBundle}
                                    actionDisabled={actionDisabled}
                                    onRequestInstall={onRequestInstall}
                                />
                            ))
                        )}
                    </Stack>
                </Stack>
            </Stack>
        </Drawer>
    );
}
