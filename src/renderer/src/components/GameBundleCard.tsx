import { GameBundle } from "../../../shared/game-bundle/GameBundle";
import { GithubRelease } from "../../../shared/GithubRelease";
import type React from "react";
import { Badge, Button, Card, Group, Stack, Text } from "@mantine/core";
import { getReleaseDisplayName } from "@renderer/utils/getReleaseDisplayName";
import { formatDate } from "@renderer/utils/formatDate";
import { toInstalledReleaseNotesTarget } from "@renderer/utils/toInstalledReleaseNotesTarget";
import { useModalOpen } from "@renderer/modals/useModalStore";
import { useTranslate } from "@renderer/localization/useLocaleStore";

interface Props {
    gameBundle: GameBundle;
    release: GithubRelease | null;
    onSetActive: (gameBundleId: string) => Promise<void>;
    actionDisabled: boolean;
    onConfirmDelete: (gameBundleId: GameBundle, deleteUserdata: boolean) => void;
}

export function GameBundleCard({ gameBundle, release, actionDisabled, onSetActive, onConfirmDelete }: Props): React.JSX.Element {
    const t = useTranslate();

    const openModal = useModalOpen();

    const onDeleteClick = (): void => openModal({ kind: "delete-game-bundle", gameBundle: gameBundle, onConfirm: (gameBundle, deleteUserdata) => onConfirmDelete(gameBundle, deleteUserdata) });

    return (
        <Card withBorder radius="md" p="sm" className="version-card">
            <Stack gap="xs">
                <Stack gap={2}>
                    <Group gap="xs">
                        <Text fw={700}>{getReleaseDisplayName(gameBundle)}</Text>
                        {gameBundle.isActive && <Badge variant="light">{t("versions.badge.active")}</Badge>}
                    </Group>
                    <Text size="xs" c="dimmed">
                        {t("versions.installed.installedAt", { date: formatDate(gameBundle.manifest.installedAt) })}
                    </Text>
                    <Text size="xs" c="dimmed">
                        {t("versions.installed.saves")}
                    </Text>
                </Stack>
                <Group gap="xs">
                    {!gameBundle.isActive && (
                        <Button size="xs" variant="light" disabled={actionDisabled} onClick={() => void onSetActive(gameBundle.id)}>
                            {t("versions.action.makeActive")}
                        </Button>
                    )}
                    <Button size="xs" variant="subtle" onClick={() => void window.api.game.openGameBundleFolder(gameBundle.id)}>
                        {t("versions.action.openGameBundleFolder")}
                    </Button>
                    <Button size="xs" variant="subtle" onClick={() => void window.api.game.openSavesFolder(gameBundle.id)}>
                        {t("versions.action.openSavesFolder")}
                    </Button>
                    <Button size="xs" variant="subtle" onClick={() => openModal({ kind: "release-notes", notes: toInstalledReleaseNotesTarget(gameBundle, release) })}>
                        {t("versions.action.showChanges")}
                    </Button>
                    <Button size="xs" variant="subtle" disabled={gameBundle.isActive || actionDisabled} color="red" onClick={onDeleteClick}>
                        {t("versions.action.delete")}
                    </Button>
                </Group>
            </Stack>
        </Card>
    );
}
