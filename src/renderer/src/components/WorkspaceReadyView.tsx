import { WorkspaceStatus } from "../../../shared/workspace/WorkspaceStatus";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getEffectiveGameChannels } from "../../../shared/game-channel/getEffectiveGameChannels";
import { findGameChannel } from "../../../shared/game-channel/findGameChannel";
import { DistributiveState } from "../../../shared/distributive/DistributiveState";
import { InstallDistributiveProgress } from "../../../shared/distributive/InstallDistributiveProgress";
import { BackupProgress } from "../../../shared/backups/types/BackupProgress";
import { BackupSummary } from "../../../shared/backups/types/BackupSummary";
import { GameRuntimeState } from "../../../shared/GameRuntimeState";
import { GithubRelease } from "../../../shared/GithubRelease";
import { useModalOpen } from "@renderer/modals/useModalStore";
import { BackupSummaryUpdate } from "../../../shared/backups/types/BackupSummaryUpdate";
import { GameSaveSummaryUpdate } from "../../../shared/GameSaveSummaryUpdate";
import { getUpdateReleases } from "@renderer/utils/getUpdateReleases";
import { isInstallRunning } from "@renderer/utils/isInstallRunning";
import { BackupInstanceInfo } from "../../../shared/backups/types/BackupInstanceInfo";
import { toUpdateReleaseNotesTarget } from "@renderer/utils/toUpdateReleaseNotesTarget";
import { useConfigStore } from "@renderer/stores/useConfigStore";
import { BackupsDrawer } from "@renderer/components/BackupsDrawer";
import { VersionsDrawer } from "@renderer/components/VersionsDrawer";
import { Alert, Badge, Button, Card, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { localizeChannelName } from "@renderer/utils/localizeChannelName";
import { getGameChannelRepositoryUrl } from "../../../shared/game-channel/getGameChannelRepositoryUrl";
import { SaveStatusLine } from "@renderer/components/SaveStatusLine";
import { InstallProgressCard } from "@renderer/components/InstallProgressCard";
import { InstallPrompt } from "@renderer/components/InstallPrompt";
import { VersionStrip } from "@renderer/components/VersionStrip";
import { getReleaseDisplayName } from "@renderer/utils/getReleaseDisplayName";
import { BackupStrip } from "@renderer/components/BackupStrip";
import { LastWorldButton } from "@renderer/components/LastWorldButton";
import { BackupCreateButton } from "@renderer/components/BackupCreateButton";
import { useTranslate } from "@renderer/localization/useLocaleStore";

export function WorkspaceReadyView({ repository }: { repository: Extract<WorkspaceStatus, { status: "ready" }> }): React.JSX.Element {
    const t = useTranslate();
    const channels = getEffectiveGameChannels(repository.config.customGameChannels);
    const selectedChannel = findGameChannel(channels, repository.config.selectedChannelId);
    const [gameState, setGameState] = useState<DistributiveState>({ status: "loading" });
    const [installProgress, setInstallProgress] = useState<InstallDistributiveProgress>({ status: "idle" });
    const [backupProgress, setBackupProgress] = useState<BackupProgress>({ status: "idle" });
    const [backupSummary, setBackupSummary] = useState<BackupSummary>({ backups: [], latestBackup: null });
    const [runtime, setRuntime] = useState<GameRuntimeState>({ status: "idle" });
    const [versionsOpened, setVersionsOpened] = useState(false);
    const [backupsOpened, setBackupsOpened] = useState(false);
    const [isCheckingLatest, setCheckingLatest] = useState(false);
    const [availableReleases, setAvailableReleases] = useState<GithubRelease[]>([]);
    const [isLoadingReleaseNotes, setLoadingReleaseNotes] = useState(false);
    const previousRuntimeStatus = useRef<GameRuntimeState["status"]>("idle");
    const installedIds = useMemo(() => new Set(gameState.status === "ready" ? gameState.distributives.map((install) => install.id) : []), [gameState]);

    const openModal = useModalOpen();

    const applyGameState = useCallback((nextState: DistributiveState): void => {
        setGameState(nextState);
        if (nextState.status === "ready") setBackupSummary(nextState.backups);
        if (nextState.status !== "ready" || !nextState.updateAvailable) setAvailableReleases([]);
    }, []);

    const refreshGameState = useCallback(
        async (refreshLatest = true, forceRefresh = false): Promise<void> => {
            if (refreshLatest) setCheckingLatest(true);
            try {
                applyGameState(await window.api.game.getState({ refreshLatest, forceRefresh }));
            } catch (error) {
                setGameState({ status: "error", message: error instanceof Error ? error.message : String(error) });
            } finally {
                if (refreshLatest) setCheckingLatest(false);
            }
        },
        [applyGameState]
    );

    useEffect(() => {
        const unsubscribeProgress = window.api.game.onInstallProgress(setInstallProgress);
        const unsubscribeRuntime = window.api.game.onRuntimeChanged(setRuntime);
        const unsubscribeBackupProgress = window.api.game.onBackupProgress(setBackupProgress);
        const unsubscribeBackups = window.api.game.onBackupSummaryChanged((update: BackupSummaryUpdate) => {
            setGameState((currentState) => {
                if (currentState.status !== "ready" || currentState.distributive?.id !== update.installId) return currentState;
                return { ...currentState, backups: update.summary };
            });
            setBackupSummary(update.summary);
        });
        const unsubscribeSaves = window.api.game.onSaveSummaryChanged((update: GameSaveSummaryUpdate) => {
            setGameState((currentState) => {
                if (currentState.status !== "ready" || currentState.distributive?.id !== update.installId) return currentState;
                return { ...currentState, saves: update.saves };
            });
        });
        const unsubscribeSaveActivity = window.api.game.onSaveActivityChanged((update) => {
            setGameState((currentState) => {
                if (currentState.status !== "ready" || currentState.distributive?.id !== update.distributiveId) return currentState;
                return { ...currentState, savesStable: update.stable };
            });
        });
        window.api.game
            .getRuntimeState()
            .then(setRuntime)
            .catch((error) => console.error("Failed to read game runtime", error));
        return () => {
            unsubscribeProgress();
            unsubscribeRuntime();
            unsubscribeSaves();
            unsubscribeSaveActivity();
            unsubscribeBackupProgress();
            unsubscribeBackups();
        };
    }, []);

    useEffect(() => {
        const previousStatus = previousRuntimeStatus.current;
        previousRuntimeStatus.current = runtime.status;
        if (previousStatus === "running" && runtime.status === "idle") void refreshGameState(false);
    }, [refreshGameState, runtime.status]);

    useEffect(() => {
        let disposed = false;

        const loadLocalStateThenCheckLatest = async (): Promise<void> => {
            setGameState({ status: "loading" });
            setAvailableReleases([]);
            setCheckingLatest(false);

            try {
                const localState = await window.api.game.getState({ refreshLatest: false });
                if (disposed) return;
                applyGameState(localState);

                if (localState.status !== "ready") return;

                setCheckingLatest(true);
                try {
                    const latestState = await window.api.game.getState({ refreshLatest: true, forceRefresh: false });
                    if (!disposed) applyGameState(latestState);
                } catch (error) {
                    if (!disposed) {
                        setGameState((currentState) =>
                            currentState.status === "ready"
                                ? {
                                      ...currentState,
                                      latestRelease: null,
                                      latestReleaseError: error instanceof Error ? error.message : String(error),
                                      updateAvailable: false
                                  }
                                : { status: "error", message: error instanceof Error ? error.message : String(error) }
                        );
                    }
                } finally {
                    if (!disposed) setCheckingLatest(false);
                }
            } catch (error) {
                if (!disposed) setGameState({ status: "error", message: error instanceof Error ? error.message : String(error) });
            }
        };

        queueMicrotask(() => void loadLocalStateThenCheckLatest());

        return () => {
            disposed = true;
        };
    }, [applyGameState, repository.path, selectedChannel.id]);

    const activeInstall = gameState.status === "ready" ? gameState.distributive : null;
    const hasInstalledVersions = gameState.status === "ready" && gameState.distributives.length > 0;

    const [isInstalling, setInstalling] = useState(false);
    const openInstallModal = (release: GithubRelease | null): void => {
        if (release === null) return;
        openModal({
            kind: "install-options",
            release,
            hasInstalledVersions,
            onConfirm: async (release, copyUserdata, removeOlderInstalls) => {
                setVersionsOpened(false);

                setInstalling(true);
                try {
                    const result = await window.api.game.installLatest({ releaseId: release.id, makeActive: true, copyUserdata, removeOlderInstalls });
                    result.status === "installed" ? setGameState(result.state) : setGameState({ status: "error", message: result.message });
                } finally {
                    setInstalling(false);
                }
            }
        });
    };

    const latestRelease = gameState.status === "ready" ? gameState.latestRelease : null;
    const latestReleaseError = gameState.status === "ready" ? gameState.latestReleaseError : null;
    const updateAvailable = gameState.status === "ready" && gameState.updateAvailable;
    const activeInstallId = activeInstall?.id ?? null;
    const latestInstalledId = latestRelease !== null && installedIds.has(latestRelease.id) ? latestRelease.id : null;
    const updateReleases = useMemo(() => (activeInstall === null ? [] : getUpdateReleases(activeInstall, availableReleases)), [activeInstall, availableReleases]);
    const installRunning = isInstallRunning(isInstalling, installProgress);
    const gameRunning = runtime.status === "running";
    const saveSummary = gameState.status === "ready" ? gameState.saves : null;
    const worlds = saveSummary?.worlds ?? [];
    const currentWorld = saveSummary?.currentWorld ?? null;
    const savesStable = gameState.status !== "ready" || gameState.savesStable;

    const launchGame = async (worldName?: string): Promise<void> => {
        const result = await window.api.game.launchActiveInstall(worldName === undefined ? {} : { worldName });
        if (result.status === "unavailable") setGameState({ status: "error", message: result.message });
        else setRuntime(result.runtime);
    };

    const stopGame = async (): Promise<void> => {
        const result = await window.api.game.stop();
        setRuntime(result.runtime);
        if (result.status === "error") setGameState({ status: "error", message: result.message });
    };

    const createBackup = async (worldName?: string): Promise<void> => {
        const result = await window.api.game.createManualBackup(worldName === undefined ? {} : { worldName });
        if (result.status === "created") setBackupSummary(result.summary);
        else if (result.status === "error") setGameState({ status: "error", message: result.message });
        else if (result.status === "blocked") console.info(`[game-backup] ${result.message}`);
    };

    const restoreBackup = async (backupId: string): Promise<void> => {
        const result = await window.api.game.restoreBackup(backupId);
        if (result.status === "restored") {
            setBackupSummary(result.summary);
            await refreshGameState(false);
        } else if (result.status === "error") setGameState({ status: "error", message: result.message });
    };

    const deleteBackup = async (backup: BackupInstanceInfo): Promise<void> => {
        const result = await window.api.game.deleteBackup(backup.id);
        if (result.status === "deleted") setBackupSummary(result.summary);
        else if (result.status === "error") setGameState({ status: "error", message: result.message });
    };

    const requestDeleteBackup = (backup: BackupInstanceInfo, skipConfirmation: boolean): void => {
        if (skipConfirmation) void deleteBackup(backup);
        else openModal({ kind: "delete-backup", backup, onConfirm: deleteBackup });
    };

    const renameBackup = async (backupId: string, comment: string): Promise<void> => {
        const result = await window.api.game.renameBackup(backupId, comment);
        if (result.status === "renamed") setBackupSummary(result.summary);
        else if (result.status === "error") setGameState({ status: "error", message: result.message });
    };

    const showUpdateChanges = async (): Promise<void> => {
        if (activeInstall === null || latestRelease === null) return;
        let releases = availableReleases;
        if (releases.length === 0) {
            setLoadingReleaseNotes(true);
            try {
                releases = await window.api.game.getReleases();
                setAvailableReleases(releases);
            } catch (error) {
                console.error("Failed to load update release notes", error);
                setAvailableReleases([]);
                releases = [];
            } finally {
                setLoadingReleaseNotes(false);
            }
        }

        openModal({ kind: "release-notes", notes: toUpdateReleaseNotesTarget(activeInstall, latestRelease, getUpdateReleases(activeInstall, releases), t) });
    };

    const backupsEnabled = useConfigStore((state) => state.backupsEnabled);

    return (
        <>
            <BackupsDrawer
                opened={backupsOpened}
                summary={backupSummary}
                gameRunning={gameRunning}
                onClose={() => setBackupsOpened(false)}
                onRestore={restoreBackup}
                onDelete={requestDeleteBackup}
                onRename={renameBackup}
            />
            <VersionsDrawer
                opened={versionsOpened}
                state={gameState}
                installedIds={installedIds}
                isInstalling={isInstalling}
                onClose={() => setVersionsOpened(false)}
                onRefresh={() => refreshGameState(true, true)}
                onRequestInstall={openInstallModal}
                onSetActive={async (installId) => {
                    const result = await window.api.game.setActiveInstall(installId);
                    result.status === "updated" ? setGameState(result.state) : setGameState({ status: "error", message: result.message });
                }}
                onDelete={async (distributive, deleteUserdata) => {
                    const result = await window.api.game.deleteInstall(distributive.id, { deleteUserdata });
                    result.status === "deleted" ? setGameState(result.state) : setGameState({ status: "error", message: result.message });
                }}
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
                                    {activeInstallId !== null && (
                                        <>
                                            <Button size="compact-xs" variant="subtle" onClick={() => void window.api.game.openInstallFolder(activeInstallId)}>
                                                {t("home.action.openInstallFolder")}
                                            </Button>
                                            <Button size="compact-xs" variant="subtle" onClick={() => void window.api.game.openSavesFolder(activeInstallId)}>
                                                {t("home.action.openSavesFolder")}
                                            </Button>
                                        </>
                                    )}
                                </Group>
                            </Stack>
                            <Badge color={activeInstall === null ? "gray" : updateAvailable ? "blue" : "green"} variant="light" size="lg">
                                {activeInstall === null ? t("home.status.notInstalled") : updateAvailable ? t("home.status.updateAvailable") : t("home.status.installed")}
                            </Badge>
                        </Group>
                        <SaveStatusLine activeInstallAvailable={activeInstall !== null} world={currentWorld} worldCount={worlds.length} />
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
                        {gameState.status === "ready" && gameState.latestReleaseError !== null && activeInstall === null && (
                            <Alert variant="light" color="red" title={t("home.gameState.error.title")}>
                                <Group justify="space-between" gap="sm">
                                    <Text size="sm">{t("home.version.checkFailed", { message: gameState.latestReleaseError })}</Text>
                                    <Button size="xs" variant="light" loading={isCheckingLatest} onClick={() => void refreshGameState(true, true)}>
                                        {t("home.action.checkAgain")}
                                    </Button>
                                </Group>
                            </Alert>
                        )}
                        {(isInstalling || installProgress.status !== "idle") && <InstallProgressCard progress={installProgress} />}
                        {activeInstall === null && gameState.status === "ready" && !installRunning && (
                            <InstallPrompt
                                description={latestRelease === null ? t("home.install.noRelease") : t("home.install.description")}
                                installLabel={t("home.action.install")}
                                loading={isInstalling}
                                disabled={latestRelease === null}
                                onInstall={() => openInstallModal(latestRelease)}
                                onOpenVersions={() => setVersionsOpened(true)}
                            />
                        )}
                        {activeInstall !== null && !installRunning && (
                            <VersionStrip
                                currentVersion={getReleaseDisplayName(activeInstall)}
                                latestRelease={latestRelease}
                                latestReleaseError={latestReleaseError}
                                updateAvailable={updateAvailable}
                                updateReleases={updateReleases}
                                isChecking={isCheckingLatest}
                                isInstalling={isInstalling}
                                isLoadingReleaseNotes={isLoadingReleaseNotes}
                                latestInstalledId={latestInstalledId}
                                onInstall={() => openInstallModal(latestRelease)}
                                onActivateLatest={async (installId) => {
                                    const result = await window.api.game.setActiveInstall(installId);
                                    result.status === "updated" ? setGameState(result.state) : setGameState({ status: "error", message: result.message });
                                }}
                                onCheckAgain={() => refreshGameState(true, true)}
                                onOpenVersions={() => setVersionsOpened(true)}
                                onShowUpdateChanges={() => void showUpdateChanges()}
                            />
                        )}
                        <BackupStrip
                            enabled={backupsEnabled}
                            activeInstallAvailable={activeInstall !== null}
                            progress={backupProgress}
                            latestBackup={backupSummary.latestBackup}
                            gameRunning={gameRunning}
                            onOpenBackups={() => setBackupsOpened(true)}
                            onRestore={restoreBackup}
                            onDelete={requestDeleteBackup}
                            onRename={renameBackup}
                        />
                        <Group justify="space-between" align="center" wrap="nowrap">
                            <Group gap="xs" wrap="wrap">
                                <Button
                                    size="md"
                                    color={gameRunning ? "orange" : "green"}
                                    disabled={activeInstall === null}
                                    leftSection={gameRunning ? "■" : "▶"}
                                    onClick={() => void (gameRunning ? stopGame() : launchGame())}
                                >
                                    {gameRunning ? t("home.action.stop") : t("home.action.play")}
                                </Button>
                                <LastWorldButton activeInstallAvailable={activeInstall !== null} gameRunning={gameRunning} worlds={worlds} currentWorld={currentWorld} onLaunch={launchGame} />
                            </Group>
                            <BackupCreateButton
                                enabled={backupsEnabled}
                                activeInstallAvailable={activeInstall !== null}
                                worlds={worlds}
                                currentWorld={currentWorld}
                                savesStable={savesStable}
                                backupBusy={backupProgress.status === "creating" || backupProgress.status === "restoring"}
                                onCreate={createBackup}
                            />
                        </Group>
                    </Stack>
                </Card>
            </Stack>
        </>
    );
}
