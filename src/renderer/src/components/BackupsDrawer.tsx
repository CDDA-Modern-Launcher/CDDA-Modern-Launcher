import { BackupInstanceInfo } from "../../../shared/backups/types/BackupInstanceInfo";
import React, { ReactNode } from "react";
import { Alert, Badge, Card, Drawer, Group, Stack, Text } from "@mantine/core";
import { formatBackupTimestamp } from "@renderer/utils/formatBackupTimestamp";
import { LocalizedText } from "@renderer/components/LocalizedText";
import { TLocalizeFn, useTranslate } from "@renderer/stores/useLocaleStore";
import { useGameBackupStore } from "@renderer/stores/useGameBackupStore";
import { useCloseDrawer, useIsDrawerOpened } from "@renderer/stores/useDrawerStore";
import { BackupControl } from "@renderer/components/backups/BackupControl";

export function BackupsDrawer(): React.JSX.Element {
    const t = useTranslate();
    const isOpened = useIsDrawerOpened("backups");
    const close = useCloseDrawer();
    const backupSummary = useGameBackupStore((state) => state.summary);

    return (
        <Drawer
            opened={isOpened}
            onClose={close}
            position="right"
            size={520}
            title={
                <Text fw={700} size="lg">
                    {t("backups.title")}
                </Text>
            }
        >
            <Stack gap="md">
                <LocalizedText size="sm" c="dimmed" i18nKey="backups.description" />
                {backupSummary.backups.length === 0 ? (
                    <Alert variant="light" color="gray" title={t("backups.empty.title")}>
                        <LocalizedText size="sm" i18nKey="backups.empty.description" />
                    </Alert>
                ) : (
                    backupSummary.backups.map((backup) => <BackupView backup={backup} t={t} key={backup.id} />)
                )}
            </Stack>
        </Drawer>
    );
}

interface BackupViewProps {
    backup: BackupInstanceInfo;
    t: TLocalizeFn;
}

function BackupView({ backup, t }: BackupViewProps): ReactNode {
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

                <BackupControl backup={backup} />
            </Group>
        </Card>
    );
}
