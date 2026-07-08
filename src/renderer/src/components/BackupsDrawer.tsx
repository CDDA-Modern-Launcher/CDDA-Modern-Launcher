import { BackupInstanceInfo } from "../../../shared/backups/types/BackupInstanceInfo";
import React, { ReactNode, useCallback } from "react";
import { Alert, Badge, Button, Card, Drawer, Group, Stack, Text, Title, Tooltip } from "@mantine/core";
import { formatBackupTimestamp } from "@renderer/utils/formatBackupTimestamp";

import { RenameBackupButton } from "@renderer/components/RenameBackupButton";
import { LocalizedText } from "@renderer/components/LocalizedText";
import { TLocalizeFn, useTranslate } from "@renderer/stores/useLocaleStore";
import { useIsGameRunning } from "@renderer/stores/useGameRuntimeStore";
import { useGameFileOperationStore } from "@renderer/stores/useGameFileOperationStore";
import { useDeleteBackup } from "@renderer/hooks/useDeleteBackup";
import { useGameBackupStore } from "@renderer/stores/useGameBackupStore";
import { useRestoreBackup } from "@renderer/hooks/useRestoreBackup";
import { useDrawerStore, useIsDrawerOpened } from "@renderer/stores/useDrawerStore";

export function BackupsDrawer(): React.JSX.Element {
    const t = useTranslate();
    const isOpened = useIsDrawerOpened("backups");
    const close = useDrawerStore((state) => state.close);

    const gameRunning = useIsGameRunning();
    const fileOperationRunning = useGameFileOperationStore((state) => state.isRunning);
    const backupSummary = useGameBackupStore((state) => state.summary);
    const restoreBackup = useRestoreBackup();
    const deleteBackup = useDeleteBackup();

    return (
        <Drawer opened={isOpened} onClose={close} position="right" size={520} title={<Title order={3}>{t("backups.title")}</Title>}>
            <Stack gap="md">
                <LocalizedText size="sm" c="dimmed" i18nKey="backups.description" />
                {backupSummary.backups.length === 0 ? (
                    <Alert variant="light" color="gray" title={t("backups.empty.title")}>
                        <LocalizedText size="sm" i18nKey="backups.empty.description" />
                    </Alert>
                ) : (
                    backupSummary.backups.map((backup) => (
                        <BackupView backup={backup} t={t} gameRunning={gameRunning} fileOperationRunning={fileOperationRunning} restoreBackup={restoreBackup} deleteBackup={deleteBackup} key={backup.id} />
                    ))
                )}
            </Stack>
        </Drawer>
    );
}

interface BackupViewProps {
    backup: BackupInstanceInfo;
    t: TLocalizeFn;
    gameRunning: boolean;
    fileOperationRunning: boolean;
    restoreBackup: ReturnType<typeof useRestoreBackup>;
    deleteBackup: ReturnType<typeof useDeleteBackup>;
}

function BackupView({ backup, t, gameRunning, fileOperationRunning, restoreBackup, deleteBackup }: BackupViewProps): ReactNode {
    const handleRestoreClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => restoreBackup(backup, event.shiftKey), [backup, restoreBackup]);
    const handleDeleteClick = useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => deleteBackup(backup, event.shiftKey), [backup, deleteBackup]);

    const restoreDisabled = gameRunning || fileOperationRunning;

    return (
        <Card key={backup.id} withBorder radius="md" p="sm">
            <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                <Stack gap={2} className="backup-drawer-item__text">
                    <Group gap="xs">
                        {backup.comment.trim().length === 0 ? (
                            <LocalizedText size="sm" fw={700} truncate i18nKey="backup.latest.title" />
                        ) : (
                            <Text size="sm" fw={700} truncate>
                                {backup.comment}
                            </Text>
                        )}
                        <Badge size="xs" variant="light">
                            {backup.type === "manual" ? t("backup.type.manual") : t("backup.type.auto")}
                        </Badge>
                    </Group>
                    <LocalizedText size="xs" c="dimmed" i18nKey="backup.latest.world.and.character" variables={{ world: backup.worldName, character: backup.characterName }} />
                    <LocalizedText size="xs" c="dimmed" i18nKey="backup.latest.created.at" variables={{ createdAt: formatBackupTimestamp(backup.createdAt) ?? t("home.world.unknown") }} />
                </Stack>
                <Stack gap={4} align="stretch" className="backup-drawer-item__actions">
                    <Tooltip label={gameRunning ? t("backup.action.restore.blocked.running") : t("backup.action.restore.tooltip")}>
                        <Button size="xs" disabled={restoreDisabled} onClick={handleRestoreClick}>
                            {t("backup.action.restore")}
                        </Button>
                    </Tooltip>
                    <RenameBackupButton backup={backup} disabled={fileOperationRunning} />
                    <Button size="xs" variant="subtle" color="red" disabled={fileOperationRunning} onClick={handleDeleteClick}>
                        {t("backup.action.delete")}
                    </Button>
                </Stack>
            </Group>
        </Card>
    );
}
