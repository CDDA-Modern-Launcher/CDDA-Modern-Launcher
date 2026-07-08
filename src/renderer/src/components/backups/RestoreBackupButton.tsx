import { BackupInstanceInfo } from "../../../../shared/backups/types/BackupInstanceInfo";
import React, { useCallback } from "react";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useIsGameRunning } from "@renderer/stores/useGameRuntimeStore";
import { useRestoreBackup } from "@renderer/hooks/useRestoreBackup";
import { Button, Tooltip } from "@mantine/core";

export function RestoreBackupButton({ backup, disabled }: { backup: BackupInstanceInfo | null; disabled?: boolean }): React.JSX.Element | null {
    const t = useTranslate();
    const gameRunning = useIsGameRunning();
    const restoreBackup = useRestoreBackup();
    const handleRestoreClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => restoreBackup(backup, event.shiftKey), [backup, restoreBackup]);

    if (!backup) return null;

    return (
        <Tooltip label={gameRunning ? t("backup.action.restore.blocked.running") : t("backup.action.restore.tooltip")}>
            <Button size="xs" disabled={gameRunning || disabled} onClick={handleRestoreClick}>
                {t("backup.action.restore")}
            </Button>
        </Tooltip>
    );
}
