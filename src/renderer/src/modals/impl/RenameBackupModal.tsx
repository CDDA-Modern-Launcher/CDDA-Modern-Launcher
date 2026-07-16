import React, { ChangeEvent, useCallback, useEffect, useState } from "react";
import { Alert, Button, Group, Stack, TextInput } from "@mantine/core";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { ContextModalProps, modals } from "@mantine/modals";
import { BackupInstanceInfo } from "../../../../shared/backups/types/BackupInstanceInfo";
import { useGameBackupStore } from "@renderer/stores/useGameBackupStore";
import { getErrorMessage } from "../../../../shared/getErrorMessage";
import { LocalizedText } from "@renderer/components/LocalizedText";

export function RenameBackupModal({ id, innerProps: { backup } }: ContextModalProps<{ backup: BackupInstanceInfo }>): React.JSX.Element {
    const t = useTranslate();
    const [value, setValue] = useState(backup?.comment ?? "");
    const [renaming, setRenaming] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const renameBackup = useGameBackupStore((state) => state.rename);

    const handleClose = useCallback(() => modals.close(id), [id]);

    const handleConfirm = useCallback(async () => {
        try {
            setRenaming(true);
            setError(null);
            await renameBackup(backup.id, value);
            handleClose();
        } catch (e) {
            console.error("Can't rename backup", e);
            setError(getErrorMessage(e));
        } finally {
            setRenaming(false);
        }
    }, [backup.id, handleClose, renameBackup, value]);

    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        setValue(event.currentTarget.value);
    }, []);

    useEffect(() => {
        modals.updateModal({
            modalId: id,
            closeOnClickOutside: !renaming,
            closeOnEscape: !renaming,
            withCloseButton: !renaming
        });
    }, [id, renaming]);

    return (
        <form onSubmit={handleConfirm}>
            <Stack gap="md">
                <TextInput label={t("backup.rename.label")} value={value} onChange={handleChange} data-autofocus disabled={renaming} />
                <LocalizedText size="xs" c="dimmed" i18nKey="backup.rename.description" />

                {!!error && (
                    <Alert variant="light" color="red" title={t("common.error.title")}>
                        <LocalizedText size="sm" i18nKey="common.error.text" variables={{ error }} />
                    </Alert>
                )}

                <Group justify="flex-end" gap="xs">
                    <Button variant="subtle" onClick={handleClose} disabled={renaming}>
                        {t("common.cancel")}
                    </Button>
                    <Button type="submit" loading={renaming}>
                        {t("backup.action.save")}
                    </Button>
                </Group>
            </Stack>
        </form>
    );
}
