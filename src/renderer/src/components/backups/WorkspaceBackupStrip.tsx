import React from "react";
import { Badge, Card, Group, Progress, Stack, Text, Tooltip } from "@mantine/core";
import { formatBackupTimestamp } from "@renderer/utils/formatBackupTimestamp";
import { TLocalizeFn, useTranslate } from "@renderer/stores/useLocaleStore";
import { useConfigStore } from "@renderer/stores/useConfigStore";
import { useGameStateStore } from "@renderer/stores/useGameStateStore";
import { useGameBackupStore } from "@renderer/stores/useGameBackupStore";
import { LocalizedText } from "@renderer/components/LocalizedText";
import { BackupControl } from "@renderer/components/backups/BackupControl";
import { BackupInstanceInfo } from "../../../../shared/backups/types/BackupInstanceInfo";

export function WorkspaceBackupStrip(): React.JSX.Element | null {
    const t = useTranslate();

    const backupsEnabled = useConfigStore((state) => state.backupsEnabled);
    const backupSummary = useGameBackupStore((state) => state.summary);
    const backupProgress = useGameBackupStore((state) => state.progress);
    const gameState = useGameStateStore((state) => state.state);

    const activeGameBundle = gameState.status === "ready" ? gameState.gameBundle : null;

    if (!backupsEnabled || !activeGameBundle) return null;
    if (backupProgress.status === "idle" && backupSummary.latestBackup === null) return null;

    if (backupProgress.status === "creating" || backupProgress.status === "restoring") {
        return (
            <Card withBorder radius="md" p="sm" className="backup-strip">
                <Stack gap="xs">
                    <Group justify="space-between" gap="sm">
                        <LocalizedText size="sm" fw={700} i18nKey={backupProgress.status === "creating" ? "backup.progress.creating" : "backup.progress.restoring"} />
                        {backupProgress.percent === null ? (
                            <LocalizedText size="xs" c="dimmed" i18nKey="backup.progress.preparing" />
                        ) : (
                            <Text size="xs" c="dimmed">
                                {backupProgress.percent}%
                            </Text>
                        )}
                    </Group>
                    <Progress value={backupProgress.percent ?? 100} animated={backupProgress.percent === null} />
                </Stack>
            </Card>
        );
    }

    const backup = backupSummary.latestBackup;
    if (backup === null) return null;
    const createdAt = formatBackupTimestamp(backup.createdAt) ?? t("home.world.unknown");

    return (
        <Card withBorder radius="md" p="sm" className="backup-strip">
            <Group justify="space-between" gap="sm" wrap="nowrap" align="flex-start">
                <Stack gap={4} className="backup-strip__text">
                    <Group gap="xs" wrap="wrap">
                        <BackupComment backup={backup} />

                        <BackupTypeBadge backup={backup} t={t} />

                        <Tooltip label={<LocalizedText size="sm" i18nKey="backup.latest.created.at" variables={{ createdAt }} />}>
                            <Badge size="xs" variant="outline">
                                {createdAt}
                            </Badge>
                        </Tooltip>
                    </Group>
                    <LocalizedText size="xs" c="dimmed" i18nKey="backup.latest.world.and.character" variables={{ world: backup.worldName, character: backup.characterName }} />
                </Stack>

                <BackupControl backup={backup} />
            </Group>
        </Card>
    );
}

function BackupTypeBadge({ backup, t }: { backup: BackupInstanceInfo; t: TLocalizeFn }): React.JSX.Element {
    if (backup.type === "manual") {
        return (
            <Tooltip label={<LocalizedText size="sm" i18nKey="backup.type.manual.tooltip" />}>
                <Badge size="xs" variant="light">
                    {t("backup.type.manual")}
                </Badge>
            </Tooltip>
        );
    } else {
        return (
            <Tooltip label={<LocalizedText size="sm" i18nKey="backup.type.auto.tooltip" />}>
                <Badge size="xs" variant="light">
                    {t("backup.type.auto")}
                </Badge>
            </Tooltip>
        );
    }
}

function BackupComment({ backup }: { backup: BackupInstanceInfo }): React.JSX.Element | null {
    const comment = backup.comment.trim();

    if (!comment) {
        return <LocalizedText size="sm" fw={700} i18nKey="backup.latest.title" />;
    }

    return (
        <Text size="sm" fw={700}>
            {comment}
        </Text>
    );
}
