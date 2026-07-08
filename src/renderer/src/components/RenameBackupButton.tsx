import { BackupInstanceInfo } from "../../../shared/backups/types/BackupInstanceInfo";
import React, { useCallback } from "react";
import { Button } from "@mantine/core";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { openModal } from "@renderer/modals/contextModals";

export function RenameBackupButton({ backup, disabled = false }: { backup: BackupInstanceInfo; disabled?: boolean }): React.JSX.Element {
    const t = useTranslate();
    const handleClick = useCallback(async () => openModal("renameBackup", t("backup.rename.title"), { backup }), [backup, t]);
    return (
        <Button size="xs" variant="subtle" disabled={disabled} onClick={handleClick}>
            {t("backup.action.rename")}
        </Button>
    );
}
