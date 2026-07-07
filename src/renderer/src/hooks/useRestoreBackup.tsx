import { BackupInstanceInfo } from "../../../shared/backups/types/BackupInstanceInfo";
import { useGameBackupStore } from "@renderer/stores/useGameBackupStore";
import { useCallback } from "react";
import { modals } from "@mantine/modals";
import { Stack, Text } from "@mantine/core";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { coalesceText } from "../../../shared/coalesceText";

export function useRestoreBackup(): (backup: BackupInstanceInfo | null, skipConfirmation?: boolean) => void {
    const t = useTranslate();
    const restoreBackup = useGameBackupStore((state) => state.restore);

    return useCallback(
        (backup: BackupInstanceInfo | null, skipConfirmation: boolean = false): void => {
            if (!backup) return;
            if (skipConfirmation) {
                void restoreBackup(backup.id);
            } else {
                modals.openConfirmModal({
                    title: t("backup.action.restoreConfirm.title"),
                    children: (
                        <Stack gap="xs">
                            <Text size="sm">{t("backup.action.restoreConfirm.message", { comment: coalesceText(backup.comment, t("backup.latest.title")) })}</Text>
                            <Text size="xs" c="dimmed">
                                {t("confirmation.shiftHint")}
                            </Text>
                        </Stack>
                    ),
                    labels: { confirm: t("common.restore"), cancel: t("common.cancel") },
                    confirmProps: { color: "red" },
                    onConfirm: () => void restoreBackup(backup.id)
                });
            }
        },
        [restoreBackup, t]
    );
}
