import { BackupInstanceInfo } from "../../../shared/backups/types/BackupInstanceInfo";
import React, { useCallback } from "react";
import { useLocalization } from "@renderer/localization/LocalizationContext";
import { Button } from "@mantine/core";
import { useModalOpen } from "@renderer/modals/useModalStore";

export function RenameBackupButton({ backup, onRename }: { backup: BackupInstanceInfo; onRename: (backupId: string, comment: string) => Promise<void> }): React.JSX.Element {
    const { t } = useLocalization();

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
