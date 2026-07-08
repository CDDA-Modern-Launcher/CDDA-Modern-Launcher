import { BackupInstanceInfo } from "../../../shared/backups/types/BackupInstanceInfo";
import { useGameBackupStore } from "@renderer/stores/useGameBackupStore";
import { useCallback } from "react";
import { modals } from "@mantine/modals";
import { Stack, Text } from "@mantine/core";
import { useTranslate } from "@renderer/stores/useLocaleStore";

export function useDeleteBackup(): (backup: BackupInstanceInfo | null, skipConfirmation?: boolean) => void {
    const t = useTranslate();
    const deleteBackup = useGameBackupStore((state) => state.delete);
    return useCallback(
        (backup: BackupInstanceInfo | null, skipConfirmation: boolean = false): void => {
            if (!backup) return;
            if (skipConfirmation) {
                void deleteBackup(backup.id);
            } else {
                modals.openConfirmModal({
                    title: t("backup.action.restore.confirm.title"),
                    children: (
                        <Stack gap="xs">
                            <Text size="sm">
                                {t("backup.delete.description", { title: backup.comment.trim().length === 0 ? t("backup.latest.title") : backup.comment, world: backup.worldName, character: backup.characterName })}
                            </Text>
                            <Text size="xs" c="dimmed">
                                {t("confirmation.shift.hint")}
                            </Text>
                        </Stack>
                    ),
                    labels: { confirm: t("common.delete"), cancel: t("common.cancel") },
                    confirmProps: { color: "red" },
                    onConfirm: () => void deleteBackup(backup.id)
                });
            }
        },
        [deleteBackup, t]
    );
}
