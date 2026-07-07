import { WorkspaceStatus } from "../../../shared/workspace/WorkspaceStatus";
import React, { useEffect, useMemo, useState } from "react";
import { getEffectiveGameChannels } from "../../../shared/game-channel/getEffectiveGameChannels";
import { findGameChannel } from "../../../shared/game-channel/findGameChannel";
import { GithubRelease } from "../../../shared/GithubRelease";
import { useModalOpen } from "@renderer/modals/useModalStore";
import { getUpdateReleases } from "@renderer/utils/getUpdateReleases";
import { BackupInstanceInfo } from "../../../shared/backups/types/BackupInstanceInfo";
import { toUpdateReleaseNotesTarget } from "@renderer/utils/toUpdateReleaseNotesTarget";
import { useConfigStore } from "@renderer/stores/useConfigStore";
import { BackupsDrawer } from "@renderer/components/BackupsDrawer";
import { VersionsDrawer } from "@renderer/components/VersionsDrawer";
import { Alert, Badge, Button, Card, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { localizeChannelName } from "@renderer/utils/localizeChannelName";
import { getGameChannelRepositoryUrl } from "../../../shared/game-channel/getGameChannelRepositoryUrl";
import { SaveStatusLine } from "@renderer/components/SaveStatusLine";
import { GameBundleInstallProgressCard } from "@renderer/components/GameBundleInstallProgressCard";
import { GameBundlePrompt } from "@renderer/components/GameBundlePrompt";
import { VersionStrip } from "@renderer/components/VersionStrip";
import { getReleaseDisplayName } from "@renderer/utils/getReleaseDisplayName";
import { BackupStrip } from "@renderer/components/BackupStrip";
import { useTranslate } from "@renderer/localization/useLocaleStore";
import { useGameRuntimeState } from "@renderer/stores/useGameRuntimeStore";
import { PrimaryGameActions } from "@renderer/components/PrimaryGameActions";
import { selectIsGameBundleInstallRunning, useGameBundleStore } from "@renderer/stores/useGameBundleStore";

export function WorkspaceReadyView({ repository }: { repository: Extract<WorkspaceStatus, { status: "ready" }> }): React.JSX.Element {
    const t = useTranslate();
    const channels = getEffectiveGameChannels(repository.config.customGameChannels);
    const selectedChannel = findGameChannel(channels, repository.config.selectedChannelId);
    const openModal = useModalOpen();

    const gameState = useGameBundleStore((state) => state.state);
    const installProgress = useGameBundleStore((state) => state.installProgress);
    const backupProgress = useGameBundleStore((state) => state.backupProgress);
    const backupSummary = useGameBundleStore((state) => state.backupSummary);
    const isCheckingLatest = useGameBundleStore((state) => state.isCheckingLatest);
    const isInstallingGameBundle = useGameBundleStore((state) => state.isInstallingGameBundle);
    const availableReleases = useGameBundleStore((state) => state.releases);
    const isLoadingReleases = useGameBundleStore((state) => state.isLoadingReleases);
    const isLoadingReleaseNotes = useGameBundleStore((state) => state.isLoadingReleaseNotes);
    const loadGame = useGameBundleStore((state) => state.load);
    const refreshGame = useGameBundleStore((state) => state.refresh);
    const loadReleases = useGameBundleStore((state) => state.loadReleases);
    const installLatestGameBundle = useGameBundleStore((state) => state.installLatestGameBundle);
    const setActiveGameBundle = useGameBundleStore((state) => state.setActiveGameBundle);
    const deleteGameBundle = useGameBundleStore((state) => state.deleteGameBundle);
    const restoreBackup = useGameBundleStore((state) => state.restoreBackup);
    const deleteBackup = useGameBundleStore((state) => state.deleteBackup);
    const renameBackup = useGameBundleStore((state) => state.renameBackup);
    const setReleaseNotesLoading = useGameBundleStore((state) => state.setReleaseNotesLoading);
    const installRunning = useGameBundleStore(selectIsGameBundleInstallRunning);
    const fileOperationRunning = useGameBundleStore((state) => state.isFileOperationRunning);

    const [versionsOpened, setVersionsOpened] = useState(false);
    const [backupsOpened, setBackupsOpened] = useState(false);
    const gameChannelId = gameState.status === "ready" ? gameState.channel.id : "";

    useEffect(() => {
        queueMicrotask(() => void loadGame());
    }, [loadGame, repository.path, selectedChannel.id]);

    useEffect(() => {
        if (!versionsOpened) return;
        queueMicrotask(() => void loadReleases());
    }, [versionsOpened, gameChannelId, loadReleases]);

    const activeGameBundle = gameState.status === "ready" ? gameState.gameBundle : null;
    const activeGameBundleId = activeGameBundle?.id ?? null;
    const hasInstalledVersions = gameState.status === "ready" && gameState.gameBundles.length > 0;
    const latestRelease = gameState.status === "ready" ? gameState.latestRelease : null;
    const latestReleaseError = gameState.status === "ready" ? gameState.latestReleaseError : null;
    const updateAvailable = gameState.status === "ready" && gameState.updateAvailable;
    const saveSummary = gameState.status === "ready" ? gameState.saves : null;
    const worlds = saveSummary?.worlds ?? [];
    const currentWorld = saveSummary?.currentWorld ?? null;
    const gameBundleIds = useMemo(() => new Set(gameState.status === "ready" ? gameState.gameBundles.map((gameBundle) => gameBundle.id) : []), [gameState]);
    const latestInstalledId = latestRelease !== null && gameBundleIds.has(latestRelease.id) ? latestRelease.id : null;
    const updateReleases = useMemo(() => (activeGameBundle === null ? [] : getUpdateReleases(activeGameBundle, availableReleases)), [activeGameBundle, availableReleases]);

    const runtimeState = useGameRuntimeState();
    const gameRunning = runtimeState.status === "running";
    const backupsEnabled = useConfigStore((state) => state.backupsEnabled);

    const openInstallModal = (release: GithubRelease | null): void => {
        if (release === null) return;
        openModal({
            kind: "game-bundle-options",
            release,
            hasInstalledVersions,
            onConfirm: async (release, copyUserdata, removeOlderGameBundles) => {
                setVersionsOpened(false);
                await installLatestGameBundle({ releaseId: release.id, makeActive: true, copyUserdata, removeOlderGameBundles });
            }
        });
    };

    const requestDeleteBackup = (backup: BackupInstanceInfo, skipConfirmation: boolean): void => {
        if (skipConfirmation) void deleteBackup(backup.id);
        else openModal({ kind: "delete-backup", backup, onConfirm: (backup) => deleteBackup(backup.id) });
    };

    const refreshVersions = async (): Promise<void> => {
        await Promise.all([refreshGame(true, true), loadReleases(true)]);
    };

    const showUpdateChanges = async (): Promise<void> => {
        if (activeGameBundle === null || latestRelease === null) return;

        let releases = availableReleases;
        if (releases.length === 0) {
            setReleaseNotesLoading(true);
            try {
                releases = await loadReleases();
            } finally {
                setReleaseNotesLoading(false);
            }
        }

        openModal({ kind: "release-notes", notes: toUpdateReleaseNotesTarget(activeGameBundle, latestRelease, getUpdateReleases(activeGameBundle, releases), t) });
    };

    return (
        <>
            <BackupsDrawer
                opened={backupsOpened}
                summary={backupSummary}
                gameRunning={gameRunning}
                actionDisabled={fileOperationRunning}
                onClose={() => setBackupsOpened(false)}
                onRestore={async (backupId) => {
                    await restoreBackup(backupId);
                }}
                onDelete={requestDeleteBackup}
                onRename={async (backupId, comment) => {
                    await renameBackup(backupId, comment);
                }}
            />
            <VersionsDrawer
                opened={versionsOpened}
                state={gameState}
                gameBundleIds={gameBundleIds}
                releases={availableReleases}
                isLoadingReleases={isLoadingReleases}
                isInstallingGameBundle={isInstallingGameBundle}
                actionDisabled={fileOperationRunning}
                onClose={() => setVersionsOpened(false)}
                onRefresh={refreshVersions}
                onRequestInstall={openInstallModal}
                onSetActive={setActiveGameBundle}
                onDelete={(gameBundle, deleteUserdata) => deleteGameBundle(gameBundle.id, { deleteUserdata })}
            />
            <Stack className="home-dashboard" gap="lg">
                <Card withBorder radius="lg" p="xl" className="repository-card home-hero-card">
                    <Stack gap="lg">
                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                            <Stack gap={4}>
                                <Text size="sm" c="dimmed" tt="uppercase" fw={700} className="eyebrow">
                                    {t("home.eyebrow")}
                                </Text>
                                <Title order={1}>{selectedChannel.gameName}</Title>
                                <Group gap="xs">
                                    <Badge variant="light">{localizeChannelName(selectedChannel.channelName, t)}</Badge>
                                    <Badge component="button" variant="outline" className="home-repository-badge" onClick={() => void window.api.shell.openExternal(getGameChannelRepositoryUrl(selectedChannel))}>
                                        {selectedChannel.githubOwner}/{selectedChannel.githubRepo}
                                    </Badge>
                                    {activeGameBundleId !== null && (
                                        <>
                                            <Button size="compact-xs" variant="subtle" onClick={() => void window.api.game.openGameBundleFolder(activeGameBundleId)}>
                                                {t("home.action.openGameBundleFolder")}
                                            </Button>
                                            <Button size="compact-xs" variant="subtle" onClick={() => void window.api.game.openSavesFolder(activeGameBundleId)}>
                                                {t("home.action.openSavesFolder")}
                                            </Button>
                                        </>
                                    )}
                                </Group>
                            </Stack>
                            <Badge color={activeGameBundle === null ? "gray" : updateAvailable ? "blue" : "green"} variant="light" size="lg">
                                {activeGameBundle === null ? t("home.status.noGameBundle") : updateAvailable ? t("home.status.updateAvailable") : t("home.status.installed")}
                            </Badge>
                        </Group>
                        <SaveStatusLine activeGameBundleAvailable={activeGameBundle !== null} world={currentWorld} worldCount={worlds.length} />
                        {gameState.status === "loading" && (
                            <Alert variant="light" color="blue" title={t("home.gameState.loading.title")}>
                                <Group gap="sm">
                                    <Loader size="sm" />
                                    <Text size="sm">{t("home.gameState.loading.description")}</Text>
                                </Group>
                            </Alert>
                        )}
                        {gameState.status === "error" && (
                            <Alert variant="light" color="red" title={t("home.gameState.error.title")}>
                                <Text size="sm">{gameState.message ?? t("home.gameState.error.description")}</Text>
                            </Alert>
                        )}
                        {gameState.status === "ready" && gameState.latestReleaseError !== null && activeGameBundle === null && (
                            <Alert variant="light" color="red" title={t("home.gameState.error.title")}>
                                <Group justify="space-between" gap="sm">
                                    <Text size="sm">{t("home.version.checkFailed", { message: gameState.latestReleaseError })}</Text>
                                    <Button size="xs" variant="light" loading={isCheckingLatest} onClick={() => void refreshGame(true, true)}>
                                        {t("home.action.checkAgain")}
                                    </Button>
                                </Group>
                            </Alert>
                        )}
                        {(isInstallingGameBundle || installProgress.status !== "idle") && <GameBundleInstallProgressCard progress={installProgress} />}
                        {activeGameBundle === null && gameState.status === "ready" && !installRunning && (
                            <GameBundlePrompt
                                description={latestRelease === null ? t("home.install.noRelease") : t("home.install.description")}
                                installLabel={t("home.action.install")}
                                loading={isInstallingGameBundle}
                                disabled={latestRelease === null || fileOperationRunning}
                                onInstall={() => openInstallModal(latestRelease)}
                                onOpenVersions={() => setVersionsOpened(true)}
                            />
                        )}
                        {activeGameBundle !== null && !installRunning && (
                            <VersionStrip
                                currentVersion={getReleaseDisplayName(activeGameBundle)}
                                latestRelease={latestRelease}
                                latestReleaseError={latestReleaseError}
                                updateAvailable={updateAvailable}
                                updateReleases={updateReleases}
                                isChecking={isCheckingLatest}
                                isInstallingGameBundle={isInstallingGameBundle}
                                isLoadingReleaseNotes={isLoadingReleaseNotes}
                                actionDisabled={fileOperationRunning}
                                latestInstalledId={latestInstalledId}
                                onInstall={() => openInstallModal(latestRelease)}
                                onActivateLatest={async (gameBundleId) => {
                                    await setActiveGameBundle(gameBundleId);
                                }}
                                onCheckAgain={() => refreshGame(true, true)}
                                onOpenVersions={() => setVersionsOpened(true)}
                                onShowUpdateChanges={() => void showUpdateChanges()}
                            />
                        )}
                        <BackupStrip
                            enabled={backupsEnabled}
                            activeGameBundleAvailable={activeGameBundle !== null}
                            progress={backupProgress}
                            latestBackup={backupSummary.latestBackup}
                            gameRunning={gameRunning}
                            actionDisabled={fileOperationRunning}
                            onOpenBackups={() => setBackupsOpened(true)}
                            onRestore={async (backupId) => {
                                await restoreBackup(backupId);
                            }}
                            onDelete={requestDeleteBackup}
                            onRename={async (backupId, comment) => {
                                await renameBackup(backupId, comment);
                            }}
                        />

                        <PrimaryGameActions />
                    </Stack>
                </Card>
            </Stack>
        </>
    );
}
