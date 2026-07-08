import { BackupInstanceInfo } from "../../../shared/backups/types/BackupInstanceInfo";
import { useGameBackupStore } from "@renderer/stores/useGameBackupStore";
import { useCallback } from "react";
import { modals } from "@mantine/modals";
import { Stack } from "@mantine/core";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { coalesceText } from "../../../shared/coalesceText";
import { LocalizedText } from "@renderer/components/LocalizedText";

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
                    title: t("backup.action.restore.confirm.title"),
                    children: (
                        <Stack gap="xs">
                            <LocalizedText size="sm" i18nKey="backup.action.restore.confirm.message" variables={{ comment: coalesceText(backup.comment, t("backup.latest.title")) }} />
                            <LocalizedText size="xs" c="dimmed" i18nKey="confirmation.shift.hint" />
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
