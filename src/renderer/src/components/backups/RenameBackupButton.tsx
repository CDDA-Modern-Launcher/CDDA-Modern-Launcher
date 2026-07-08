import { BackupInstanceInfo } from "../../../../shared/backups/types/BackupInstanceInfo";
import React, { useCallback } from "react";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { openModal } from "@renderer/modals/contextModals";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconEdit } from "@tabler/icons-react";
import { defaultIconProps } from "@renderer/utils/defaultIconProps";

export function RenameBackupButton({ backup, disabled = false }: { backup: BackupInstanceInfo; disabled?: boolean }): React.JSX.Element {
    const t = useTranslate();
    const handleRename = useCallback(async () => openModal("renameBackup", t("backup.rename.title"), { backup }), [backup, t]);
    const buttonName = t("backup.action.rename");
    return (
        <Tooltip label={buttonName}>
            <ActionIcon size={30} variant="subtle" disabled={disabled} onClick={handleRename} aria-label={buttonName}>
                <IconEdit {...defaultIconProps} />
            </ActionIcon>
        </Tooltip>
    );
}
