import { BackupInstanceInfo } from "../../../../shared/backups/types/BackupInstanceInfo";
import React, { useCallback } from "react";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useDeleteBackup } from "@renderer/hooks/useDeleteBackup";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { defaultIconProps } from "@renderer/utils/defaultIconProps";

export function DeleteBackupButton({ backup, disabled = false }: { backup: BackupInstanceInfo; disabled?: boolean }): React.JSX.Element {
    const t = useTranslate();
    const deleteBackup = useDeleteBackup();
    const handleDelete = useCallback((event: React.MouseEvent<HTMLButtonElement>) => deleteBackup(backup, event.shiftKey), [backup, deleteBackup]);
    const buttonName = t("backup.action.delete");
    return (
        <Tooltip label={buttonName}>
            <ActionIcon size={30} variant="subtle" color="red" disabled={disabled} onClick={handleDelete} aria-label={buttonName}>
                <IconTrash {...defaultIconProps} />
            </ActionIcon>
        </Tooltip>
    );
}
