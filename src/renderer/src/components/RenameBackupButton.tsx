import { BackupInstanceInfo } from "../../../shared/backups/types/BackupInstanceInfo";
import React, { useCallback } from "react";
import { Button } from "@mantine/core";
import { useModalOpen } from "@renderer/modals/useModalStore";
import { useTranslate } from "@renderer/localization/useLocaleStore";

export function RenameBackupButton({ backup, onRename }: { backup: BackupInstanceInfo; onRename: (backupId: string, comment: string) => Promise<void> }): React.JSX.Element {
    const t = useTranslate();

    const openModal = useModalOpen();

    const handleClick = useCallback(async () => {
        openModal({
            kind: "rename-backup",
            backup,
            onConfirm: async (backup, comment) => {
                await onRename(backup.id, comment);
            }
        });
    }, [backup, onRename, openModal]);

    return (
        <>
            <Button size="xs" variant="subtle" onClick={handleClick}>
                {t("backup.action.rename")}
            </Button>
        </>
    );
}
