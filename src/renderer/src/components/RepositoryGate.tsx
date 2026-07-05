import { ActionIcon, Alert, Anchor, Badge, Box, Button, Card, Checkbox, Divider, Drawer, Group, Loader, Menu, Modal, Progress, Stack, Text, TextInput, Title, Tooltip } from "@mantine/core";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type GameBackup, type GameBackupProgress, type GameBackupSummary, type GameBackupSummaryUpdate } from "../../../shared/backups";
import { findGameChannel, getEffectiveGameChannels, getGameChannelRepositoryUrl } from "../../../shared/gameChannels";
import { GameInstall, GameInstallProgress, GameInstallState, GameRelease, GameRuntimeState, GameSaveSummaryUpdate, GameWorldInfo, InstallGameOptions } from "../../../shared/gameInstallations";
import { REPOSITORY_CONFIG_FILE_NAME, RepositoryStatus } from "../../../shared/repository";
import { useLauncherSettings } from "../hooks/useLauncherSettings";
import { useLocalization } from "../localization/LocalizationContext";

export type RepositoryGateProps = { repository: RepositoryStatus; isSelecting: boolean; onSelectRepository: () => void };

export function RepositoryGate({ repository, isSelecting, onSelectRepository }: RepositoryGateProps): React.JSX.Element {
    if (repository.status === "loading") return <LoadingRepository path={repository.path} />;
    if (repository.status === "ready") return <ReadyRepository repository={repository} />;
    return <RepositorySetup repository={repository} isSelecting={isSelecting} onSelectRepository={onSelectRepository} />;
}

function RepositorySetup({
    repository,
    isSelecting,
    onSelectRepository
}: {
    repository: Extract<RepositoryStatus, { status: "unconfigured" | "invalid" }>;
    isSelecting: boolean;
    onSelectRepository: () => void;
}): React.JSX.Element {
    const { t } = useLocalization();
    return (
        <Card withBorder radius="lg" p="xl" className="repository-card">
            <Stack gap="lg">
                <Stack gap={4}>
                    <Text size="sm" c="dimmed" tt="uppercase" fw={700} className="eyebrow">
                        {t("repository.setup.eyebrow")}
                    </Text>
                    <Title order={1}>{t("repository.setup.title")}</Title>
                    <Text c="dimmed">{t("repository.setup.description")}</Text>
                </Stack>
                {repository.status === "invalid" && (
                    <Alert color="red" title={t("repository.setup.invalidTitle")} variant="light">
                        <Stack gap={6}>
                            {repository.path.length > 0 && <Text size="sm">{repository.path}</Text>}
                            <Text size="sm">{repository.message}</Text>
                        </Stack>
                    </Alert>
                )}
                <Stack gap="xs" className="repository-rules">
                    <Text size="sm">{t("repository.setup.rule.emptyFolder")}</Text>
                    <Text size="sm">
                        {t("repository.setup.rule.nonEmptyFolder.prefix")} <code>{REPOSITORY_CONFIG_FILE_NAME}</code>.
                    </Text>
                    <Text size="sm">{t("repository.setup.rule.persistedPath")}</Text>
                </Stack>
                <Group justify="flex-end">
                    <Button loading={isSelecting} onClick={onSelectRepository}>
                        {t("repository.setup.selectButton")}
                    </Button>
                </Group>
            </Stack>
        </Card>
    );
}

function LoadingRepository({ path }: { path: string }): React.JSX.Element {
    const { t } = useLocalization();
    return (
        <Card withBorder radius="lg" p="xl" className="repository-card">
            <Group gap="lg" wrap="nowrap">
                <Loader />
                <Stack gap={2}>
                    <Title order={2}>{t("repository.loading.title")}</Title>
                    <Text c="dimmed">{t("repository.loading.description", { fileName: REPOSITORY_CONFIG_FILE_NAME })}</Text>
                    <Text size="sm" className="path-text">
                        {path}
                    </Text>
                </Stack>
            </Group>
        </Card>
    );
}

function ReadyRepository({ repository }: { repository: Extract<RepositoryStatus, { status: "ready" }> }): React.JSX.Element {
    const { t } = useLocalization();
    const channels = getEffectiveGameChannels(repository.config.customChannels);
    const selectedChannel = findGameChannel(channels, repository.config.selectedChannelId);
    const [gameState, setGameState] = useState<GameInstallState>({ status: "loading" });
    const [installProgress, setInstallProgress] = useState<GameInstallProgress>({ status: "idle" });
    const [backupProgress, setBackupProgress] = useState<GameBackupProgress>({ status: "idle" });
    const [backupSummary, setBackupSummary] = useState<GameBackupSummary>({ backups: [], latestBackup: null });
    const [runtime, setRuntime] = useState<GameRuntimeState>({ status: "idle" });
    const [versionsOpened, setVersionsOpened] = useState(false);
    const [backupsOpened, setBackupsOpened] = useState(false);
    const [deleteBackupTarget, setDeleteBackupTarget] = useState<GameBackup | null>(null);
    const [isInstalling, setInstalling] = useState(false);
    const [isCheckingLatest, setCheckingLatest] = useState(false);
    const [copyUserdata, setCopyUserdata] = useState(false);
    const [removeOldVersions, setRemoveOldVersions] = useState(false);
    const [installModalRelease, setInstallModalRelease] = useState<GameRelease | null>(null);
    const [releaseNotesTarget, setReleaseNotesTarget] = useState<ReleaseNotesTarget | null>(null);
    const [availableReleases, setAvailableReleases] = useState<GameRelease[]>([]);
    const [isLoadingReleaseNotes, setLoadingReleaseNotes] = useState(false);
    const previousRuntimeStatus = useRef<GameRuntimeState["status"]>("idle");
    const launcherSettings = useLauncherSettings();
    const installedIds = useMemo(() => new Set(gameState.status === "ready" ? gameState.installs.map((install) => install.id) : []), [gameState]);

    const applyGameState = useCallback((nextState: GameInstallState): void => {
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
        const unsubscribeBackups = window.api.game.onBackupSummaryChanged((update: GameBackupSummaryUpdate) => {
            setGameState((currentState) => {
                if (currentState.status !== "ready" || currentState.activeInstall?.id !== update.installId) return currentState;
                return { ...currentState, backups: update.summary };
            });
            setBackupSummary(update.summary);
        });
        const unsubscribeSaves = window.api.game.onSaveSummaryChanged((update: GameSaveSummaryUpdate) => {
            setGameState((currentState) => {
                if (currentState.status !== "ready" || currentState.activeInstall?.id !== update.installId) return currentState;
                return { ...currentState, saves: update.saves };
            });
        });
        const unsubscribeSaveActivity = window.api.game.onSaveActivityChanged((update) => {
            setGameState((currentState) => {
                if (currentState.status !== "ready" || currentState.activeInstall?.id !== update.installId) return currentState;
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

    const installRelease = async (releaseId?: string): Promise<void> => {
        setInstalling(true);
        try {
            const options: InstallGameOptions = { releaseId, makeActive: true, copyUserdata, removeOlderInstalls: removeOldVersions };
            const result = await window.api.game.installLatest(options);
            result.status === "installed" ? setGameState(result.state) : setGameState({ status: "error", message: result.message });
        } finally {
            setInstalling(false);
        }
    };

    const activeInstall = gameState.status === "ready" ? gameState.activeInstall : null;
    const hasInstalledVersions = gameState.status === "ready" && gameState.installs.length > 0;

    const openInstallModal = (release: GameRelease | null): void => {
        if (release === null) return;
        setCopyUserdata(activeInstall !== null);
        setRemoveOldVersions(false);
        setInstallModalRelease(release);
    };

    const confirmInstall = (): void => {
        const release = installModalRelease;
        if (release === null) return;
        setInstallModalRelease(null);
        setVersionsOpened(false);
        void installRelease(release.id);
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

    const deleteBackup = async (backupId: string): Promise<void> => {
        const result = await window.api.game.deleteBackup(backupId);
        if (result.status === "deleted") setBackupSummary(result.summary);
        else if (result.status === "error") setGameState({ status: "error", message: result.message });
    };

    const requestDeleteBackup = (backup: GameBackup, skipConfirmation: boolean): void => {
        if (skipConfirmation) void deleteBackup(backup.id);
        else setDeleteBackupTarget(backup);
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
        setReleaseNotesTarget(toUpdateReleaseNotesTarget(activeInstall, latestRelease, getUpdateReleases(activeInstall, releases), t));
    };

    return (
        <>
            <ReleaseNotesModal target={releaseNotesTarget} onClose={() => setReleaseNotesTarget(null)} />
            <InstallOptionsModal
                opened={installModalRelease !== null}
                release={installModalRelease}
                hasInstalledVersions={hasInstalledVersions}
                copyUserdata={copyUserdata}
                removeOldVersions={removeOldVersions}
                isInstalling={isInstalling}
                onCopyUserdata={setCopyUserdata}
                onRemoveOldVersions={setRemoveOldVersions}
                onCancel={() => setInstallModalRelease(null)}
                onConfirm={confirmInstall}
            />
            <DeleteBackupModal
                backup={deleteBackupTarget}
                onCancel={() => setDeleteBackupTarget(null)}
                onConfirm={(backupId) => {
                    setDeleteBackupTarget(null);
                    void deleteBackup(backupId);
                }}
            />
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
                onDelete={async (installId, deleteUserdata) => {
                    const result = await window.api.game.deleteInstall(installId, { deleteUserdata });
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
                                    <Badge variant="light">{selectedChannel.channelName}</Badge>
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
                        {activeInstall !== null && (
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
                            enabled={launcherSettings.backupsEnabled}
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
                                enabled={launcherSettings.backupsEnabled}
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

function SaveStatusLine({ activeInstallAvailable, world, worldCount }: { activeInstallAvailable: boolean; world: GameWorldInfo | null; worldCount: number }): React.JSX.Element {
    const { t } = useLocalization();
    const text = getSaveStatusText(t, activeInstallAvailable, world, worldCount);
    return <Text c="dimmed">{text}</Text>;
}

function getSaveStatusText(t: ReturnType<typeof useLocalization>["t"], activeInstallAvailable: boolean, world: GameWorldInfo | null, worldCount: number): string {
    if (!activeInstallAvailable) return t("home.saveStatus.notInstalled");
    if (worldCount === 0) return t("home.saveStatus.noWorlds");
    if (world === null) return t("home.saveStatus.multipleWorlds", { count: worldCount.toString() });
    const character = world.characterName ?? t("home.world.unknown");
    return t("home.saveStatus.singleWorld", { world: world.name, character });
}

function LastWorldButton({
    activeInstallAvailable,
    gameRunning,
    worlds,
    currentWorld,
    onLaunch
}: {
    activeInstallAvailable: boolean;
    gameRunning: boolean;
    worlds: GameWorldInfo[];
    currentWorld: GameWorldInfo | null;
    onLaunch: (worldName?: string) => Promise<void>;
}): React.JSX.Element {
    const { t } = useLocalization();
    const disabled = !activeInstallAvailable || gameRunning || worlds.length === 0;
    const tooltip = gameRunning ? t("home.action.lastWorldTooltipRunning") : t("home.action.lastWorldTooltip");

    if (worlds.length <= 1) {
        return (
            <Tooltip label={tooltip}>
                <Button size="md" variant="light" disabled={disabled} leftSection="▶" onClick={() => void onLaunch(worlds[0]?.name)}>
                    {t("home.action.lastWorld")}
                </Button>
            </Tooltip>
        );
    }

    return (
        <Menu shadow="md" width={320} position="top-end" disabled={disabled}>
            <Menu.Target>
                <Tooltip label={tooltip}>
                    <Button size="md" variant="light" disabled={disabled} leftSection="▶">
                        {t("home.action.lastWorld")}
                    </Button>
                </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Label>{t("home.world.selectWorld")}</Menu.Label>
                {worlds.map((world) => (
                    <Menu.Item key={world.folderName} onClick={() => void onLaunch(world.name)} rightSection={world.folderName === currentWorld?.folderName ? "✓" : undefined}>
                        <Stack gap={0}>
                            <Text size="sm">{world.name}</Text>
                            <Text size="xs" c="dimmed">
                                {t("home.world.character", { character: world.characterName ?? t("home.world.unknown") })}
                            </Text>
                        </Stack>
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
    );
}

function BackupCreateButton({
    enabled,
    activeInstallAvailable,
    worlds,
    currentWorld,
    savesStable,
    backupBusy,
    onCreate
}: {
    enabled: boolean;
    activeInstallAvailable: boolean;
    worlds: GameWorldInfo[];
    currentWorld: GameWorldInfo | null;
    savesStable: boolean;
    backupBusy: boolean;
    onCreate: (worldName?: string) => Promise<void>;
}): React.JSX.Element {
    const { t } = useLocalization();
    const backupableWorlds = worlds.filter((world) => world.characterName !== null);
    const disabled = !enabled || !activeInstallAvailable || backupableWorlds.length === 0 || !savesStable || backupBusy;
    const tooltip = getBackupButtonTooltip(t, enabled, activeInstallAvailable, backupableWorlds.length, savesStable, backupBusy);
    const icon = (
        <ActionIcon size={42} variant="light" disabled={disabled} aria-label={t("home.backup.createTooltip")}>
            💾
        </ActionIcon>
    );

    if (backupableWorlds.length <= 1) {
        return (
            <Tooltip label={tooltip}>
                <ActionIcon size={42} variant="light" disabled={disabled} onClick={() => void onCreate(backupableWorlds[0]?.name)} aria-label={t("home.backup.createTooltip")}>
                    💾
                </ActionIcon>
            </Tooltip>
        );
    }

    return (
        <Menu shadow="md" width={320} position="top-end" disabled={disabled}>
            <Menu.Target>
                <Tooltip label={tooltip}>{icon}</Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Label>{t("home.world.selectWorld")}</Menu.Label>
                {backupableWorlds.map((world) => (
                    <Menu.Item key={world.folderName} onClick={() => void onCreate(world.name)} rightSection={world.folderName === currentWorld?.folderName ? "✓" : undefined}>
                        <Stack gap={0}>
                            <Text size="sm">{world.name}</Text>
                            <Text size="xs" c="dimmed">
                                {t("home.world.character", { character: world.characterName ?? t("home.world.unknown") })}
                            </Text>
                        </Stack>
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
    );
}

function getBackupButtonTooltip(t: ReturnType<typeof useLocalization>["t"], enabled: boolean, activeInstallAvailable: boolean, backupableWorldCount: number, savesStable: boolean, backupBusy: boolean): string {
    if (!enabled) return t("home.backup.disabledTooltip");
    if (!activeInstallAvailable) return t("home.backup.noInstallTooltip");
    if (backupableWorldCount === 0) return t("home.backup.noSaveTooltip");
    if (!savesStable) return t("home.backup.savingTooltip");
    if (backupBusy) return t("home.backup.busyTooltip");
    return t("home.backup.createTooltip");
}

function BackupStrip(props: {
    enabled: boolean;
    activeInstallAvailable: boolean;
    progress: GameBackupProgress;
    latestBackup: GameBackup | null;
    gameRunning: boolean;
    onOpenBackups: () => void;
    onRestore: (backupId: string) => Promise<void>;
    onDelete: (backup: GameBackup, skipConfirmation: boolean) => void;
    onRename: (backupId: string, comment: string) => Promise<void>;
}): React.JSX.Element | null {
    const { t } = useLocalization();
    if (!props.enabled || !props.activeInstallAvailable) return null;
    if (props.progress.status === "idle" && props.latestBackup === null) return null;

    if (props.progress.status === "creating" || props.progress.status === "restoring") {
        return (
            <Card withBorder radius="md" p="sm" className="backup-strip">
                <Stack gap="xs">
                    <Group justify="space-between" gap="sm">
                        <Text size="sm" fw={700}>
                            {props.progress.status === "creating" ? t("backup.progress.creating") : t("backup.progress.restoring")}
                        </Text>
                        <Text size="xs" c="dimmed">
                            {props.progress.percent === null ? t("backup.progress.preparing") : `${props.progress.percent}%`}
                        </Text>
                    </Group>
                    <Progress value={props.progress.percent ?? 100} animated={props.progress.percent === null} />
                </Stack>
            </Card>
        );
    }

    const backup = props.latestBackup;
    if (backup === null) return null;
    const restoreDisabled = props.gameRunning;

    return (
        <Card withBorder radius="md" p="sm" className="backup-strip">
            <Group justify="space-between" gap="sm" wrap="nowrap" align="flex-start">
                <Stack gap={4} className="backup-strip__text">
                    <Group gap="xs" wrap="wrap">
                        <Text size="sm" fw={700}>
                            {backup.comment.trim().length === 0 ? t("backup.latest.title") : backup.comment}
                        </Text>
                        <Badge size="xs" variant="light">
                            {backup.type === "manual" ? t("backup.type.manual") : t("backup.type.auto")}
                        </Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                        {t("backup.latest.worldAndCharacter", {
                            world: backup.worldName,
                            character: backup.characterName
                        })}
                    </Text>
                    <Text size="xs" c="dimmed">
                        {t("backup.latest.createdAt", { createdAt: formatBackupTimestamp(backup.createdAt) ?? t("home.world.unknown") })}
                    </Text>
                </Stack>
                <Stack gap={4} align="flex-end" className="backup-strip__actions">
                    <Group gap="xs" wrap="nowrap">
                        <Tooltip label={restoreDisabled ? t("backup.action.restoreBlockedRunning") : t("backup.action.restoreTooltip")}>
                            <Button size="xs" variant="light" disabled={restoreDisabled} onClick={() => void props.onRestore(backup.id)}>
                                {t("backup.action.restore")}
                            </Button>
                        </Tooltip>
                        <RenameBackupButton backup={backup} onRename={props.onRename} />
                    </Group>
                    <Group gap="xs" wrap="nowrap">
                        <Button size="xs" variant="subtle" onClick={props.onOpenBackups}>
                            {t("backup.action.manage")}
                        </Button>
                        <Button size="xs" variant="subtle" color="red" onClick={(event) => props.onDelete(backup, event.shiftKey)}>
                            {t("backup.action.delete")}
                        </Button>
                    </Group>
                </Stack>
            </Group>
        </Card>
    );
}

function DeleteBackupModal({ backup, onCancel, onConfirm }: { backup: GameBackup | null; onCancel: () => void; onConfirm: (backupId: string) => void }): React.JSX.Element {
    const { t } = useLocalization();
    return (
        <Modal opened={backup !== null} onClose={onCancel} title={<Title order={4}>{t("backup.delete.title")}</Title>} centered zIndex={3000}>
            <Stack gap="md">
                <Text size="sm">
                    {backup === null
                        ? ""
                        : t("backup.delete.description", {
                              title: backup.comment.trim().length === 0 ? t("backup.latest.title") : backup.comment,
                              world: backup.worldName,
                              character: backup.characterName
                          })}
                </Text>
                <Text size="xs" c="dimmed">
                    {t("backup.delete.shiftHint")}
                </Text>
                <Group justify="flex-end" gap="xs">
                    <Button variant="subtle" onClick={onCancel}>
                        {t("common.cancel")}
                    </Button>
                    <Button color="red" onClick={() => backup !== null && onConfirm(backup.id)}>
                        {t("backup.action.delete")}
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}

function RenameBackupButton({ backup, onRename }: { backup: GameBackup; onRename: (backupId: string, comment: string) => Promise<void> }): React.JSX.Element {
    const { t } = useLocalization();
    const [opened, setOpened] = useState(false);
    const [value, setValue] = useState(backup.comment);

    return (
        <>
            <Button
                size="xs"
                variant="subtle"
                onClick={() => {
                    setValue(backup.comment);
                    setOpened(true);
                }}
            >
                {t("backup.action.rename")}
            </Button>
            <Modal opened={opened} onClose={() => setOpened(false)} title={<Title order={4}>{t("backup.rename.title")}</Title>} centered zIndex={3000}>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        setOpened(false);
                        void onRename(backup.id, value);
                    }}
                >
                    <Stack gap="md">
                        <TextInput label={t("backup.rename.label")} value={value} onChange={(event) => setValue(event.currentTarget.value)} data-autofocus />
                        <Text size="xs" c="dimmed">
                            {t("backup.rename.description")}
                        </Text>
                        <Group justify="flex-end" gap="xs">
                            <Button variant="subtle" onClick={() => setOpened(false)}>
                                {t("common.cancel")}
                            </Button>
                            <Button type="submit">{t("backup.action.save")}</Button>
                        </Group>
                    </Stack>
                </form>
            </Modal>
        </>
    );
}

function BackupsDrawer(props: {
    opened: boolean;
    summary: GameBackupSummary;
    gameRunning: boolean;
    onClose: () => void;
    onRestore: (backupId: string) => Promise<void>;
    onDelete: (backup: GameBackup, skipConfirmation: boolean) => void;
    onRename: (backupId: string, comment: string) => Promise<void>;
}): React.JSX.Element {
    const { t } = useLocalization();
    return (
        <Drawer opened={props.opened} onClose={props.onClose} position="right" size={520} title={<Title order={3}>{t("backups.title")}</Title>}>
            <Stack gap="md">
                <Text size="sm" c="dimmed">
                    {t("backups.description")}
                </Text>
                {props.summary.backups.length === 0 ? (
                    <Alert variant="light" color="gray" title={t("backups.empty.title")}>
                        <Text size="sm">{t("backups.empty.description")}</Text>
                    </Alert>
                ) : (
                    props.summary.backups.map((backup) => (
                        <Card key={backup.id} withBorder radius="md" p="sm">
                            <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                                <Stack gap={2} className="backup-drawer-item__text">
                                    <Group gap="xs">
                                        <Text size="sm" fw={700} truncate>
                                            {backup.comment.trim().length === 0 ? t("backup.latest.title") : backup.comment}
                                        </Text>
                                        <Badge size="xs" variant="light">
                                            {backup.type === "manual" ? t("backup.type.manual") : t("backup.type.auto")}
                                        </Badge>
                                    </Group>
                                    <Text size="xs" c="dimmed">
                                        {t("backup.latest.worldAndCharacter", {
                                            world: backup.worldName,
                                            character: backup.characterName
                                        })}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                        {t("backup.latest.createdAt", { createdAt: formatBackupTimestamp(backup.createdAt) ?? t("home.world.unknown") })}
                                    </Text>
                                </Stack>
                                <Stack gap={4} align="stretch" className="backup-drawer-item__actions">
                                    <Tooltip label={props.gameRunning ? t("backup.action.restoreBlockedRunning") : t("backup.action.restoreTooltip")}>
                                        <Button size="xs" disabled={props.gameRunning} onClick={() => void props.onRestore(backup.id)}>
                                            {t("backup.action.restore")}
                                        </Button>
                                    </Tooltip>
                                    <RenameBackupButton backup={backup} onRename={props.onRename} />
                                    <Button size="xs" variant="subtle" color="red" onClick={(event) => props.onDelete(backup, event.shiftKey)}>
                                        {t("backup.action.delete")}
                                    </Button>
                                </Stack>
                            </Group>
                        </Card>
                    ))
                )}
            </Stack>
        </Drawer>
    );
}

function VersionStrip(props: {
    currentVersion: string;
    latestRelease: GameRelease | null;
    latestReleaseError: string | null;
    updateAvailable: boolean;
    updateReleases: GameRelease[];
    isChecking: boolean;
    isInstalling: boolean;
    isLoadingReleaseNotes: boolean;
    latestInstalledId: string | null;
    onInstall: () => void;
    onActivateLatest: (installId: string) => Promise<void>;
    onCheckAgain: () => Promise<void>;
    onOpenVersions: () => void;
    onShowUpdateChanges: () => void;
}): React.JSX.Element {
    const { t } = useLocalization();
    const [isActivatingLatest, setActivatingLatest] = useState(false);
    const updateAction = getUpdateAction(props.updateAvailable, props.latestRelease, props.latestInstalledId);

    const activateLatest = async (): Promise<void> => {
        if (props.latestInstalledId === null) return;
        setActivatingLatest(true);
        try {
            await props.onActivateLatest(props.latestInstalledId);
        } finally {
            setActivatingLatest(false);
        }
    };

    return (
        <Card withBorder radius="md" p="sm" className="home-version-strip">
            <Group justify="space-between" gap="sm" wrap="nowrap">
                <Stack gap={2} className="home-version-strip__text">
                    <Text size="xs" c="dimmed">
                        {t("home.version.current")}
                    </Text>
                    <Text size="sm" fw={700}>
                        {props.currentVersion}
                    </Text>
                    <Group gap={6} wrap="wrap">
                        <Text size="xs" c={props.latestReleaseError !== null ? "red" : props.updateAvailable ? "blue" : "dimmed"}>
                            {props.isChecking
                                ? t("home.version.checking")
                                : props.latestReleaseError !== null
                                  ? t("home.version.checkFailed", { message: props.latestReleaseError })
                                  : props.updateAvailable && props.latestRelease !== null
                                    ? t("home.version.updateAvailable", { version: getReleaseNameDisplay(props.latestRelease.name) })
                                    : props.latestRelease === null
                                      ? t("home.version.latestUnknown")
                                      : t("home.version.latestInstalled")}
                        </Text>
                        <Anchor component="button" type="button" size="xs" disabled={props.isChecking} onClick={() => void props.onCheckAgain()}>
                            {t("home.action.checkAgain")}
                        </Anchor>
                        {props.updateAvailable && props.latestRelease !== null && (
                            <Anchor component="button" type="button" size="xs" disabled={props.isLoadingReleaseNotes} onClick={props.onShowUpdateChanges}>
                                {props.isLoadingReleaseNotes ? t("home.action.loadingUpdateChanges") : t("home.action.showUpdateChanges")}
                            </Anchor>
                        )}
                    </Group>
                </Stack>
                <Group gap="xs" wrap="nowrap">
                    {updateAction === "activate" && (
                        <Button size="xs" variant="light" loading={isActivatingLatest} onClick={() => void activateLatest()}>
                            {t("home.action.activateLatest")}
                        </Button>
                    )}
                    {updateAction === "install" && (
                        <Button size="xs" variant="light" loading={props.isInstalling} onClick={props.onInstall}>
                            {t("home.action.installUpdate")}
                        </Button>
                    )}
                    <Button size="xs" variant="subtle" onClick={props.onOpenVersions}>
                        {t("home.action.openVersions")}
                    </Button>
                </Group>
            </Group>
        </Card>
    );
}

type InstallPromptProps = {
    description: string;
    installLabel: string;
    loading: boolean;
    disabled: boolean;
    onInstall: () => void;
    onOpenVersions: () => void;
};

function InstallPrompt(props: InstallPromptProps): React.JSX.Element {
    const { t } = useLocalization();
    return (
        <Alert variant="light" color="blue" title={t("home.install.title")}>
            <Stack gap="sm">
                <Text size="sm">{props.description}</Text>
                <Group gap="xs">
                    <Button size="xs" loading={props.loading} disabled={props.disabled} onClick={props.onInstall}>
                        {props.installLabel}
                    </Button>
                    <Button size="xs" variant="subtle" onClick={props.onOpenVersions}>
                        {t("home.action.chooseVersion")}
                    </Button>
                </Group>
            </Stack>
        </Alert>
    );
}

function InstallOptionsModal(props: {
    opened: boolean;
    release: GameRelease | null;
    hasInstalledVersions: boolean;
    copyUserdata: boolean;
    removeOldVersions: boolean;
    isInstalling: boolean;
    onCopyUserdata: (value: boolean) => void;
    onRemoveOldVersions: (value: boolean) => void;
    onCancel: () => void;
    onConfirm: () => void;
}): React.JSX.Element {
    const { t } = useLocalization();
    const releaseName = props.release === null ? "" : getReleaseNameDisplay(props.release.name);
    return (
        <Modal opened={props.opened} onClose={props.onCancel} title={<Title order={4}>{t("install.modal.title")}</Title>} centered zIndex={3000}>
            <Stack gap="md">
                <Stack gap={4}>
                    <Text size="sm" c="dimmed">
                        {t("install.modal.description", { version: releaseName })}
                    </Text>
                    {props.release !== null && (
                        <Text size="xs" c="dimmed">
                            {props.release.asset.name}
                        </Text>
                    )}
                </Stack>
                {props.hasInstalledVersions && (
                    <Stack gap="xs" className="install-options">
                        <Checkbox size="sm" checked={props.copyUserdata} onChange={(event) => props.onCopyUserdata(event.currentTarget.checked)} label={t("install.option.copyUserdata")} />
                        <Checkbox size="sm" checked={props.removeOldVersions} onChange={(event) => props.onRemoveOldVersions(event.currentTarget.checked)} label={t("install.option.removeOldVersions")} />
                    </Stack>
                )}
                <Group justify="flex-end" gap="xs">
                    <Button variant="subtle" onClick={props.onCancel}>
                        {t("common.cancel")}
                    </Button>
                    <Button loading={props.isInstalling} onClick={props.onConfirm}>
                        {t("versions.action.install")}
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}

function InstallProgressCard({ progress }: { progress: GameInstallProgress }): React.JSX.Element {
    const { t } = useLocalization();
    const percent = progress.status === "downloading" || progress.status === "extracting" ? progress.percent : null;
    return (
        <Card withBorder radius="md" p="sm" className="install-progress-card">
            <Stack gap="xs">
                <Group justify="space-between" wrap="nowrap">
                    <Text size="sm" fw={700}>
                        {getProgressTitle(progress, t)}
                    </Text>
                    {percent !== null && <Text size="xs">{percent}%</Text>}
                </Group>
                <Progress value={percent ?? getIndeterminateProgressValue(progress)} animated={progress.status !== "completed" && progress.status !== "error"} />
                <Text size="xs" c="dimmed">
                    {getProgressDescription(progress, t)}
                </Text>
            </Stack>
        </Card>
    );
}

type ReleaseNotesTarget = {
    title: string;
    publishedAt?: string;
    htmlUrl?: string;
    body: string;
};

function VersionsDrawer({
    opened,
    state,
    installedIds,
    isInstalling,
    onClose,
    onRefresh,
    onRequestInstall,
    onSetActive,
    onDelete
}: {
    opened: boolean;
    state: GameInstallState;
    installedIds: Set<string>;
    isInstalling: boolean;
    onClose: () => void;
    onRefresh: () => Promise<void>;
    onRequestInstall: (release: GameRelease) => void;
    onSetActive: (installId: string) => Promise<void>;
    onDelete: (installId: string, deleteUserdata: boolean) => Promise<void>;
}): React.JSX.Element {
    const { t } = useLocalization();
    const [releases, setReleases] = useState<GameRelease[]>([]);
    const [isLoadingReleases, setLoadingReleases] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<GameInstall | null>(null);
    const [releaseNotesTarget, setReleaseNotesTarget] = useState<ReleaseNotesTarget | null>(null);
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
                        {state.status === "ready" ? t("versions.description", { channel: `${state.channel.shortName} · ${state.channel.channelName}` }) : t("versions.description.unavailable")}
                    </Text>
                    <Stack gap="sm">
                        <Title order={4}>{t("versions.installed.title")}</Title>
                        {state.status !== "ready" || state.installs.length === 0 ? (
                            <Text size="sm" c="dimmed">
                                {t("versions.installed.empty")}
                            </Text>
                        ) : (
                            state.installs.map((install) => (
                                <InstallCard
                                    key={install.id}
                                    install={install}
                                    release={releaseById.get(install.id) ?? null}
                                    onSetActive={onSetActive}
                                    onRequestDelete={setDeleteTarget}
                                    onShowReleaseNotes={setReleaseNotesTarget}
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
                                    <ReleaseCard
                                        key={release.id}
                                        release={release}
                                        isInstalled={installedIds.has(release.id)}
                                        isInstalling={isInstalling}
                                        onRequestInstall={onRequestInstall}
                                        onShowReleaseNotes={setReleaseNotesTarget}
                                    />
                                ))
                            )}
                        </Stack>
                    </Stack>
                </Stack>
            </Drawer>
            <DeleteInstallModal
                key={deleteTarget?.id ?? "empty"}
                install={deleteTarget}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={(installId, deleteUserdata) => {
                    setDeleteTarget(null);
                    void onDelete(installId, deleteUserdata);
                }}
            />
            <ReleaseNotesModal target={releaseNotesTarget} onClose={() => setReleaseNotesTarget(null)} />
        </>
    );
}

function InstallCard({
    install,
    release,
    onSetActive,
    onRequestDelete,
    onShowReleaseNotes
}: {
    install: GameInstall;
    release: GameRelease | null;
    onSetActive: (installId: string) => Promise<void>;
    onRequestDelete: (install: GameInstall) => void;
    onShowReleaseNotes: (target: ReleaseNotesTarget) => void;
}): React.JSX.Element {
    const { t } = useLocalization();
    return (
        <Card withBorder radius="md" p="sm" className="version-card">
            <Stack gap="xs">
                <Stack gap={2}>
                    <Group gap="xs">
                        <Text fw={700}>{getReleaseDisplayName(install)}</Text>
                        {install.isActive && <Badge variant="light">{t("versions.badge.active")}</Badge>}
                    </Group>
                    <Text size="xs" c="dimmed">
                        {t("versions.installed.installedAt", { date: formatDate(install.manifest.installedAt) })}
                    </Text>
                    <Text size="xs" c="dimmed">
                        {t("versions.installed.saves")}
                    </Text>
                </Stack>
                <Group gap="xs">
                    {!install.isActive && (
                        <Button size="xs" variant="light" onClick={() => void onSetActive(install.id)}>
                            {t("versions.action.makeActive")}
                        </Button>
                    )}
                    <Button size="xs" variant="subtle" onClick={() => void window.api.game.openInstallFolder(install.id)}>
                        {t("versions.action.openInstallFolder")}
                    </Button>
                    <Button size="xs" variant="subtle" onClick={() => void window.api.game.openSavesFolder(install.id)}>
                        {t("versions.action.openSavesFolder")}
                    </Button>
                    <Button size="xs" variant="subtle" onClick={() => onShowReleaseNotes(toInstalledReleaseNotesTarget(install, release))}>
                        {t("versions.action.showChanges")}
                    </Button>
                    <Button size="xs" variant="subtle" disabled={install.isActive} color="red" onClick={() => onRequestDelete(install)}>
                        {t("versions.action.delete")}
                    </Button>
                </Group>
            </Stack>
        </Card>
    );
}

function ReleaseCard({
    release,
    isInstalled,
    isInstalling,
    onRequestInstall,
    onShowReleaseNotes
}: {
    release: GameRelease;
    isInstalled: boolean;
    isInstalling: boolean;
    onRequestInstall: (release: GameRelease) => void;
    onShowReleaseNotes: (target: ReleaseNotesTarget) => void;
}): React.JSX.Element {
    const { t } = useLocalization();
    return (
        <Card withBorder radius="md" p="sm" className="version-card">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={2}>
                    <Group gap="xs">
                        <Text fw={700}>{getReleaseNameDisplay(release.name)}</Text>
                        {isInstalled && <Badge variant="light">{t("versions.badge.installed")}</Badge>}
                    </Group>
                    <Text size="xs" c="dimmed">
                        {t("versions.available.publishedAt", { date: formatDate(release.publishedAt) })}
                    </Text>
                    <Text size="xs" c="dimmed">
                        {release.asset.name}
                    </Text>
                </Stack>
                <Group gap="xs" wrap="nowrap">
                    <Button size="xs" variant="subtle" onClick={() => onShowReleaseNotes(toReleaseNotesTarget(release))}>
                        {t("versions.action.showChanges")}
                    </Button>
                    <Button size="xs" disabled={isInstalled} loading={isInstalling} onClick={() => onRequestInstall(release)}>
                        {isInstalled ? t("versions.action.installed") : t("versions.action.install")}
                    </Button>
                </Group>
            </Group>
        </Card>
    );
}

function DeleteInstallModal({ install, onCancel, onConfirm }: { install: GameInstall | null; onCancel: () => void; onConfirm: (installId: string, deleteUserdata: boolean) => void }): React.JSX.Element {
    const { t } = useLocalization();
    const [deleteUserdata, setDeleteUserdata] = useState(true);

    return (
        <Modal opened={install !== null} onClose={onCancel} title={<Title order={4}>{t("deleteInstall.modal.title")}</Title>} centered zIndex={3000}>
            <Stack gap="md">
                <Text size="sm" c="dimmed">
                    {install === null ? "" : t("deleteInstall.modal.description", { version: getReleaseDisplayName(install) })}
                </Text>
                <Checkbox size="sm" checked={deleteUserdata} onChange={(event) => setDeleteUserdata(event.currentTarget.checked)} label={t("versions.option.deleteUserdata")} />
                <Group justify="flex-end" gap="xs">
                    <Button variant="subtle" onClick={onCancel}>
                        {t("common.cancel")}
                    </Button>
                    <Button color="red" onClick={() => install !== null && onConfirm(install.id, deleteUserdata)}>
                        {t("versions.action.delete")}
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}

function ReleaseNotesModal({ target, onClose }: { target: ReleaseNotesTarget | null; onClose: () => void }): React.JSX.Element {
    const { t } = useLocalization();
    const body = target?.body.trim() ?? "";
    return (
        <Modal opened={target !== null} onClose={onClose} title={<Title order={4}>{target?.title ?? t("releaseNotes.modal.title")}</Title>} centered size="xl" zIndex={3000}>
            <Stack gap="md">
                {target !== null && (target.publishedAt !== undefined || target.htmlUrl !== undefined) && (
                    <Group gap="xs">
                        {target.publishedAt !== undefined && (
                            <Text size="xs" c="dimmed">
                                {t("releaseNotes.modal.publishedAt", { date: formatDate(target.publishedAt) })}
                            </Text>
                        )}
                        {target.htmlUrl !== undefined && (
                            <Anchor size="xs" component="button" type="button" onClick={() => void window.api.shell.openExternal(target.htmlUrl!)}>
                                {t("releaseNotes.modal.openOnGithub")}
                            </Anchor>
                        )}
                    </Group>
                )}
                {body.length === 0 ? (
                    <Text size="sm" c="dimmed">
                        {t("releaseNotes.modal.empty")}
                    </Text>
                ) : (
                    <Box component="pre" className="release-notes-text">
                        {body}
                    </Box>
                )}
            </Stack>
        </Modal>
    );
}

function getUpdateReleases(activeInstall: GameInstall, releases: GameRelease[]): GameRelease[] {
    if (releases.length === 0) return [];
    const activeIndex = releases.findIndex((release) => release.id === activeInstall.id);
    if (activeIndex >= 0) return releases.slice(0, activeIndex);

    const activePublishedAt = new Date(activeInstall.manifest.publishedAt).getTime();
    if (!Number.isFinite(activePublishedAt)) return releases;
    return releases.filter((release) => new Date(release.publishedAt).getTime() > activePublishedAt);
}

function toUpdateReleaseNotesTarget(activeInstall: GameInstall, latestRelease: GameRelease, updateReleases: GameRelease[], t: (key: string, values?: Record<string, string | number>) => string): ReleaseNotesTarget {
    return {
        title: t("releaseNotes.modal.updateTitle", {
            current: getReleaseDisplayName(activeInstall),
            latest: getReleaseNameDisplay(latestRelease.name)
        }),
        body: formatUpdateReleaseNotes(updateReleases, t)
    };
}

function formatUpdateReleaseNotes(releases: GameRelease[], t: (key: string, values?: Record<string, string | number>) => string): string {
    if (releases.length === 0) return t("releaseNotes.modal.emptyUpdateRange");
    return releases
        .map((release) => {
            const body = release.body.trim() || t("releaseNotes.modal.empty");
            return [`## ${getReleaseNameDisplay(release.name)}`, t("releaseNotes.modal.publishedAt", { date: formatDate(release.publishedAt) }), "", body].join("\n");
        })
        .join("\n\n────────────────────────\n\n");
}

function toReleaseNotesTarget(release: GameRelease): ReleaseNotesTarget {
    return {
        title: getReleaseNameDisplay(release.name),
        publishedAt: release.publishedAt,
        htmlUrl: release.htmlUrl,
        body: release.body
    };
}

function toInstalledReleaseNotesTarget(install: GameInstall, release: GameRelease | null): ReleaseNotesTarget {
    if (release !== null) return toReleaseNotesTarget(release);
    return {
        title: getReleaseDisplayName(install),
        publishedAt: install.manifest.publishedAt,
        htmlUrl: install.manifest.htmlUrl,
        body: install.manifest.releaseBody ?? ""
    };
}

function getUpdateAction(updateAvailable: boolean, latestRelease: GameRelease | null, latestInstalledId: string | null): "install" | "activate" | null {
    if (!updateAvailable || latestRelease === null) return null;
    return latestInstalledId === null ? "install" : "activate";
}

function getReleaseDisplayName(install: GameInstall): string {
    return getReleaseNameDisplay(install.manifest.releaseName || install.manifest.releaseId);
}

function getReleaseNameDisplay(value: string): string {
    const buildId = value.match(/20\d{2}-\d{2}-\d{2}-\d{4}/)?.[0];
    if (buildId !== undefined) return buildId;
    return value
        .replace(/^Cataclysm-DDA experimental build\s+/i, "")
        .replace(/^Cataclysm-DDA\s+/i, "")
        .replace(/^cdda-(?:windows|linux)-[^-]+(?:-[^-]+)*-/i, "")
        .replace(/\.(?:zip|tar\.gz|tgz)$/i, "")
        .trim();
}

function getProgressTitle(progress: GameInstallProgress, t: (key: string, values?: Record<string, string | number>) => string): string {
    if (progress.status === "downloading") return t("install.progress.downloading", { version: getReleaseNameDisplay(progress.releaseName) });
    if (progress.status === "extracting") return t("install.progress.extracting", { version: getReleaseNameDisplay(progress.releaseName) });
    if (progress.status === "preparing-saves") return t("install.progress.preparingSaves");
    if (progress.status === "finalizing") return t("install.progress.finalizing");
    if (progress.status === "completed") return t("install.progress.completed");
    if (progress.status === "error") return t("install.progress.error");
    return t("install.progress.resolvingRelease");
}

function getProgressDescription(progress: GameInstallProgress, t: (key: string, values?: Record<string, string | number>) => string): string {
    if (progress.status === "downloading")
        return t("install.progress.downloadingDescription", { size: formatBytes(progress.transferredBytes), total: progress.totalBytes === null ? "?" : formatBytes(progress.totalBytes) });
    if (progress.status === "extracting") return t("install.progress.extractingDescription", { version: progress.releaseName });
    if (progress.status === "preparing-saves") return t("install.progress.preparingSavesDescription");
    if (progress.status === "finalizing") return t("install.progress.finalizingDescription");
    if (progress.status === "completed") return t("install.progress.completedDescription");
    if (progress.status === "error") return progress.message;
    return t("install.progress.resolvingReleaseDescription");
}

function getIndeterminateProgressValue(progress: GameInstallProgress): number {
    if (progress.status === "extracting") return 58;
    if (progress.status === "preparing-saves") return 76;
    if (progress.status === "finalizing") return 90;
    if (progress.status === "completed") return 100;
    if (progress.status === "error") return 100;
    return 12;
}

function isInstallRunning(isInstalling: boolean, progress: GameInstallProgress): boolean {
    if (isInstalling) return true;

    switch (progress.status) {
        case "resolving-release":
        case "downloading":
        case "extracting":
        case "preparing-saves":
        case "finalizing":
            return true;
        default:
            return false;
    }
}

function formatBytes(value: number): string {
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatBackupTimestamp(value: string | null): string | null {
    if (value === null) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const year = date.getFullYear().toString().padStart(4, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hour = date.getHours().toString().padStart(2, "0");
    const minute = date.getMinutes().toString().padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${minute}`;
}

function formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
