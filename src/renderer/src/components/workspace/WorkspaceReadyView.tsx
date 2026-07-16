import { WorkspaceStatus } from "../../../../shared/workspace/WorkspaceStatus";
import React, { useEffect } from "react";
import { Alert, Badge, Button, Card, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { localizeChannelName } from "@renderer/utils/localizeChannelName";
import { getGameChannelRepositoryUrl } from "../../../../shared/game-channel/getGameChannelRepositoryUrl";
import { SaveStatusLine } from "@renderer/components/SaveStatusLine";
import { GameBundlePrompt } from "@renderer/components/GameBundlePrompt";
import { WorkspaceInstalledVersionStrip } from "@renderer/components/WorkspaceInstalledVersionStrip";
import { WorkspaceBackupStrip } from "@renderer/components/backups/WorkspaceBackupStrip";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { PrimaryGameActions } from "@renderer/components/PrimaryGameActions";
import { useGameStateStore } from "@renderer/stores/useGameStateStore";
import { useGameReleasesStore } from "@renderer/stores/useGameReleasesStore";
import { LocalizedText } from "@renderer/components/LocalizedText";
import { openUrl } from "@renderer/utils/openUrl";
import { useSelectedGameChannel } from "@renderer/stores/useWorkspaceStore";
import { WorkspaceInvalidView } from "@renderer/components/workspace/WorkspaceInvalidView";

export function WorkspaceReadyView({ workspace }: { workspace: Extract<WorkspaceStatus, { status: "ready" }> }): React.JSX.Element {
    const t = useTranslate();
    const selectedChannel = useSelectedGameChannel();

    const gameState = useGameStateStore((state) => state.state);
    const isCheckingLatest = useGameStateStore((state) => state.isCheckingLatest);
    const loadGame = useGameStateStore((state) => state.load);
    const refreshGame = useGameStateStore((state) => state.refresh);

    const clearReleases = useGameReleasesStore((state) => state.clear);

    useEffect(() => {
        clearReleases();
        queueMicrotask(() => void loadGame());
    }, [clearReleases, loadGame, workspace.path, selectedChannel]);

    const activeGameBundle = gameState.status === "ready" ? gameState.gameBundle : null;
    const activeGameBundleId = activeGameBundle?.id ?? null;
    const updateAvailable = gameState.status === "ready" && gameState.updateAvailable;
    const isInitialReleaseCheck = activeGameBundle === null && (gameState.status === "loading" || isCheckingLatest);

    if (!selectedChannel) {
        return <WorkspaceInvalidView />;
    }

    return (
        <Card withBorder radius="lg" p="xl" className="workspace-card">
            <Stack gap="lg">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={4}>
                        <Title order={1} className="game-variant_title">
                            {selectedChannel.gameName}
                        </Title>

                        <Group gap="xs">
                            <Badge variant="light">{localizeChannelName(selectedChannel.channelName, t)}</Badge>
                            <Badge component="button" variant="outline" className="home-repository-badge" onClick={() => openUrl(getGameChannelRepositoryUrl(selectedChannel))}>
                                {selectedChannel.githubOwner}/{selectedChannel.githubRepo}
                            </Badge>
                            {activeGameBundleId !== null && (
                                <>
                                    <Button size="compact-xs" variant="subtle" onClick={() => void window.api.game.openGameBundleFolder(activeGameBundleId)}>
                                        {t("home.action.open.game.bundle.folder")}
                                    </Button>
                                    <Button size="compact-xs" variant="subtle" onClick={() => void window.api.game.openSavesFolder(activeGameBundleId)}>
                                        {t("home.action.open.saves.folder")}
                                    </Button>
                                </>
                            )}
                        </Group>
                    </Stack>

                    <Badge color={isInitialReleaseCheck ? "blue" : activeGameBundle === null ? "gray" : updateAvailable ? "blue" : "green"} variant="light" size="lg">
                        {isInitialReleaseCheck
                            ? t("home.status.checking")
                            : activeGameBundle === null
                              ? t("home.status.no.game.bundle")
                              : updateAvailable
                                ? t("home.status.update.available")
                                : t("home.status.installed")}
                    </Badge>
                </Group>

                {!isInitialReleaseCheck && <SaveStatusLine />}

                {isInitialReleaseCheck && (
                    <Alert variant="light" color="blue" title={t("home.game.state.loading.title")}>
                        <Group gap="sm">
                            <Loader size="sm" />
                            <LocalizedText size="sm" i18nKey="home.game.state.loading.description" />
                        </Group>
                    </Alert>
                )}

                {gameState.status === "error" && (
                    <Alert variant="light" color="red" title={t("home.game.state.error.title")}>
                        {gameState.message === undefined ? <LocalizedText size="sm" i18nKey="home.game.state.error.description" /> : <Text size="sm">{gameState.message}</Text>}
                    </Alert>
                )}

                {gameState.status === "ready" && gameState.latestReleaseError !== null && activeGameBundle === null && (
                    <Alert variant="light" color="red" title={t("home.game.state.error.title")}>
                        <Group justify="space-between" gap="sm">
                            <LocalizedText size="sm" i18nKey="home.version.check.failed" variables={{ message: gameState.latestReleaseError }} />
                            <Button size="xs" variant="light" loading={isCheckingLatest} onClick={() => void refreshGame(true, true)}>
                                {t("home.action.check.again")}
                            </Button>
                        </Group>
                    </Alert>
                )}

                <GameBundlePrompt />
                <WorkspaceInstalledVersionStrip />
                <WorkspaceBackupStrip />
                <PrimaryGameActions />
            </Stack>
        </Card>
    );
}
