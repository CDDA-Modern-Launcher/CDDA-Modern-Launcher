import { BackupSummary } from "../../../shared/backups/types/BackupSummary";
import { BackupInstanceInfo } from "../../../shared/backups/types/BackupInstanceInfo";
import type React from "react";
import { Alert, Badge, Button, Card, Drawer, Group, Stack, Text, Title, Tooltip } from "@mantine/core";
import { formatBackupTimestamp } from "@renderer/utils/formatBackupTimestamp";

import { RenameBackupButton } from "@renderer/components/RenameBackupButton";
import { useTranslate } from "@renderer/localization/useLocaleStore";

export function BackupsDrawer(props: {
    opened: boolean;
    summary: BackupSummary;
    gameRunning: boolean;
    actionDisabled: boolean;
    onClose: () => void;
    onRestore: (backupId: string) => Promise<void>;
    onDelete: (backup: BackupInstanceInfo, skipConfirmation: boolean) => void;
    onRename: (backupId: string, comment: string) => Promise<void>;
}): React.JSX.Element {
    const t = useTranslate();
    const restoreDisabled = props.gameRunning || props.actionDisabled;
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
                                        <Button size="xs" disabled={restoreDisabled} onClick={() => void props.onRestore(backup.id)}>
                                            {t("backup.action.restore")}
                                        </Button>
                                    </Tooltip>
                                    <RenameBackupButton backup={backup} disabled={props.actionDisabled} onRename={props.onRename} />
                                    <Button size="xs" variant="subtle" color="red" disabled={props.actionDisabled} onClick={(event) => props.onDelete(backup, event.shiftKey)}>
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
