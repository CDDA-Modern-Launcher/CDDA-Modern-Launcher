import React from "react";
import { BackupInstanceInfo } from "../../../../shared/backups/types/BackupInstanceInfo";
import { Group } from "@mantine/core";
import { RenameBackupButton } from "@renderer/components/backups/RenameBackupButton";
import { DeleteBackupButton } from "@renderer/components/backups/DeleteBackupButton";
import { useGameFileOperationStore } from "@renderer/stores/useGameFileOperationStore";
import { RestoreBackupButton } from "@renderer/components/backups/RestoreBackupButton";

interface Props {
    backup: BackupInstanceInfo | null;
}

export function BackupControl({ backup }: Props): React.JSX.Element | null {
    const fileOperationRunning = useGameFileOperationStore((state) => state.isRunning);

    if (!backup) return null;

    return (
        <Group gap="xs" wrap="nowrap">
            <RestoreBackupButton backup={backup} disabled={fileOperationRunning} />
            <Group gap={4} wrap="nowrap">
                <RenameBackupButton backup={backup} disabled={fileOperationRunning} />
                <DeleteBackupButton backup={backup} disabled={fileOperationRunning} />
            </Group>
        </Group>
    );
}
