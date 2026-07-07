import { BackupProgress } from "../../../shared/backups/types/BackupProgress";
import { BackupInstanceInfo } from "../../../shared/backups/types/BackupInstanceInfo";
import type React from "react";
import { Badge, Button, Card, Group, Progress, Stack, Text, Tooltip } from "@mantine/core";
import { formatBackupTimestamp } from "@renderer/utils/formatBackupTimestamp";
import { RenameBackupButton } from "@renderer/components/RenameBackupButton";
import { useTranslate } from "@renderer/localization/useLocaleStore";

export function BackupStrip(props: {
    enabled: boolean;
    activeInstallAvailable: boolean;
    progress: BackupProgress;
    latestBackup: BackupInstanceInfo | null;
    gameRunning: boolean;
    onOpenBackups: () => void;
    onRestore: (backupId: string) => Promise<void>;
    onDelete: (backup: BackupInstanceInfo, skipConfirmation: boolean) => void;
    onRename: (backupId: string, comment: string) => Promise<void>;
}): React.JSX.Element | null {
    const t = useTranslate();
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
