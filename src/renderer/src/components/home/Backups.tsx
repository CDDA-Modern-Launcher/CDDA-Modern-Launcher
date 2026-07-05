import { Alert, Badge, Button, Card, Drawer, Group, Modal, Progress, Stack, Text, TextInput, Title, Tooltip } from "@mantine/core";
import type React from "react";
import { useState } from "react";

import { useLocalization } from "../../localization/LocalizationContext";
import { formatBackupTimestamp } from "./homeUtils";
import { APP_MODAL_PROPS } from "./modalProps";
import { BackupInstanceInfo } from "../../../../shared/backups/types/BackupInstanceInfo";
import { BackupProgress } from "../../../../shared/backups/types/BackupProgress";
import { BackupSummary } from "../../../../shared/backups/types/BackupSummary";

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

export function DeleteBackupModal({ backup, onCancel, onConfirm }: { backup: BackupInstanceInfo | null; onCancel: () => void; onConfirm: (backupId: string) => void }): React.JSX.Element {
    const { t } = useLocalization();
    return (
        <Modal {...APP_MODAL_PROPS} opened={backup !== null} onClose={onCancel} title={<Title order={4}>{t("backup.delete.title")}</Title>}>
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

export function RenameBackupButton({ backup, onRename }: { backup: BackupInstanceInfo; onRename: (backupId: string, comment: string) => Promise<void> }): React.JSX.Element {
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
            <Modal {...APP_MODAL_PROPS} opened={opened} onClose={() => setOpened(false)} title={<Title order={4}>{t("backup.rename.title")}</Title>}>
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

export function BackupsDrawer(props: {
    opened: boolean;
    summary: BackupSummary;
    gameRunning: boolean;
    onClose: () => void;
    onRestore: (backupId: string) => Promise<void>;
    onDelete: (backup: BackupInstanceInfo, skipConfirmation: boolean) => void;
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
