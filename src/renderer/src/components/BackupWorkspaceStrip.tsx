import React, { useCallback } from "react";
import { Badge, Button, Card, Group, Progress, Stack, Text, Tooltip } from "@mantine/core";
import { formatBackupTimestamp } from "@renderer/utils/formatBackupTimestamp";
import { RenameBackupButton } from "@renderer/components/RenameBackupButton";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useConfigStore } from "@renderer/stores/useConfigStore";
import { useGameStateStore } from "@renderer/stores/useGameStateStore";
import { useGameBackupStore } from "@renderer/stores/useGameBackupStore";
import { useIsGameRunning } from "@renderer/stores/useGameRuntimeStore";
import { useGameFileOperationStore } from "@renderer/stores/useGameFileOperationStore";
import { useDeleteBackup } from "@renderer/hooks/useDeleteBackup";
import { useRestoreBackup } from "@renderer/hooks/useRestoreBackup";
import { useOpenDrawerSimple } from "@renderer/stores/useDrawerStore";

export function BackupWorkspaceStrip(): React.JSX.Element | null {
    const t = useTranslate();

    const openDrawer = useOpenDrawerSimple();

    const backupsEnabled = useConfigStore((state) => state.backupsEnabled);
    const backupSummary = useGameBackupStore((state) => state.summary);
    const backupProgress = useGameBackupStore((state) => state.progress);
    const gameState = useGameStateStore((state) => state.state);
    const gameRunning = useIsGameRunning();
    const fileOperationRunning = useGameFileOperationStore((state) => state.isRunning);

    const activeGameBundle = gameState.status === "ready" ? gameState.gameBundle : null;

    const deleteBackup = useDeleteBackup();
    const handleDeleteClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => deleteBackup(backupSummary.latestBackup, event.shiftKey), [backupSummary.latestBackup, deleteBackup]);

    const restoreBackup = useRestoreBackup();
    const handleRestoreClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => restoreBackup(backupSummary.latestBackup, event.shiftKey), [backupSummary.latestBackup, restoreBackup]);

    if (!backupsEnabled || !activeGameBundle) return null;
    if (backupProgress.status === "idle" && backupSummary.latestBackup === null) return null;

    if (backupProgress.status === "creating" || backupProgress.status === "restoring") {
        return (
            <Card withBorder radius="md" p="sm" className="backup-strip">
                <Stack gap="xs">
                    <Group justify="space-between" gap="sm">
                        <Text size="sm" fw={700}>
                            {backupProgress.status === "creating" ? t("backup.progress.creating") : t("backup.progress.restoring")}
                        </Text>
                        <Text size="xs" c="dimmed">
                            {backupProgress.percent === null ? t("backup.progress.preparing") : `${backupProgress.percent}%`}
                        </Text>
                    </Group>
                    <Progress value={backupProgress.percent ?? 100} animated={backupProgress.percent === null} />
                </Stack>
            </Card>
        );
    }

    const backup = backupSummary.latestBackup;
    if (backup === null) return null;
    const restoreDisabled = gameRunning || fileOperationRunning;

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
                            <Button size="xs" variant="light" disabled={restoreDisabled} onClick={handleRestoreClick}>
                                {t("backup.action.restore")}
                            </Button>
                        </Tooltip>
                        <RenameBackupButton backup={backup} disabled={fileOperationRunning} />
                    </Group>
                    <Group gap="xs" wrap="nowrap">
                        <Button size="xs" variant="subtle" onClick={() => openDrawer("backups")}>
                            {t("backup.action.manage")}
                        </Button>
                        <Button size="xs" variant="subtle" color="red" disabled={fileOperationRunning} onClick={handleDeleteClick}>
                            {t("backup.action.delete")}
                        </Button>
                    </Group>
                </Stack>
            </Group>
        </Card>
    );
}
