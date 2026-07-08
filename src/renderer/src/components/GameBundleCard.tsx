import { GameBundle } from "../../../shared/game-bundle/GameBundle";
import { GithubRelease } from "../../../shared/GithubRelease";
import React, { useCallback } from "react";
import { Badge, Button, Card, Group, Stack, Text } from "@mantine/core";
import { getReleaseDisplayName } from "@renderer/utils/getReleaseDisplayName";
import { formatDate } from "@renderer/utils/formatDate";
import { toInstalledReleaseNotesTarget } from "@renderer/utils/toInstalledReleaseNotesTarget";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { openModal } from "@renderer/modals/contextModals";

interface Props {
    gameBundle: GameBundle;
    release: GithubRelease | null;
    onSetActive: (gameBundleId: string) => Promise<boolean>;
    actionDisabled: boolean;
}

export function GameBundleCard({ gameBundle, release, actionDisabled, onSetActive }: Props): React.JSX.Element {
    const t = useTranslate();
    const openReleaseNotesModal = useCallback(() => openModal("showReleaseNotes", t("release.notes.modal.title"), { notes: toInstalledReleaseNotesTarget(gameBundle, release) }), [gameBundle, release, t]);
    const handleDeleteClick = useCallback(() => openModal("deleteBackup", t("versions.delete.modal.title"), { gameBundle }), [gameBundle, t]);

    return (
        <Card withBorder radius="md" p="sm" className="version-card">
            <Stack gap="xs">
                <Stack gap={2}>
                    <Group gap="xs">
                        <Text fw={700}>{getReleaseDisplayName(gameBundle)}</Text>
                        {gameBundle.isActive && <Badge variant="light">{t("versions.badge.active")}</Badge>}
                    </Group>
                    <Text size="xs" c="dimmed">
                        {t("versions.installed.installed.at", { date: formatDate(gameBundle.manifest.installedAt) })}
                    </Text>
                    <Text size="xs" c="dimmed">
                        {t("versions.installed.saves")}
                    </Text>
                </Stack>
                <Group gap="xs">
                    {!gameBundle.isActive && (
                        <Button size="xs" variant="light" disabled={actionDisabled} onClick={() => void onSetActive(gameBundle.id)}>
                            {t("versions.action.make.active")}
                        </Button>
                    )}
                    <Button size="xs" variant="subtle" onClick={() => void window.api.game.openGameBundleFolder(gameBundle.id)}>
                        {t("versions.action.open.game.bundle.folder")}
                    </Button>
                    <Button size="xs" variant="subtle" onClick={() => void window.api.game.openSavesFolder(gameBundle.id)}>
                        {t("versions.action.open.saves.folder")}
                    </Button>
                    <Button size="xs" variant="subtle" onClick={openReleaseNotesModal}>
                        {t("versions.action.show.changes")}
                    </Button>
                    <Button size="xs" variant="subtle" disabled={gameBundle.isActive || actionDisabled} color="red" onClick={handleDeleteClick}>
                        {t("versions.action.delete")}
                    </Button>
                </Group>
            </Stack>
        </Card>
    );
}
