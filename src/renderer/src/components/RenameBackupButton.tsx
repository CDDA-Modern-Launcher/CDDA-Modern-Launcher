import { BackupInstanceInfo } from "../../../shared/backups/types/BackupInstanceInfo";
import React, { useCallback } from "react";
import { Button } from "@mantine/core";
import { useModalOpen } from "@renderer/modals/useModalStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useGameBackupStore } from "@renderer/stores/useGameBackupStore";

export function RenameBackupButton({ backup, disabled = false }: { backup: BackupInstanceInfo; disabled?: boolean }): React.JSX.Element {
    const t = useTranslate();

    const openModal = useModalOpen();
    const renameBackup = useGameBackupStore((state) => state.rename);

    const handleClick = useCallback(async () => {
        openModal({
            kind: "rename-backup",
            backup,
            onConfirm: async (backup, comment) => {
                await renameBackup(backup.id, comment);
            }
        });
    }, [backup, openModal, renameBackup]);

    return (
        <>
            <Button size="xs" variant="subtle" disabled={disabled} onClick={handleClick}>
                {t("backup.action.rename")}
            </Button>
        </>
    );
}
