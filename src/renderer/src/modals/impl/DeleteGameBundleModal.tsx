import React, { ChangeEvent, useCallback, useEffect, useState } from "react";
import { Alert, Button, Checkbox, Group, Stack } from "@mantine/core";
import { getReleaseDisplayName } from "@renderer/utils/getReleaseDisplayName";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useGameBundleInstallStore } from "@renderer/stores/useGameBundleInstallStore";
import { getErrorMessage } from "../../../../shared/getErrorMessage";
import { ContextModalProps, modals } from "@mantine/modals";
import { GameBundle } from "../../../../shared/game-bundle/GameBundle";
import { LocalizedText } from "@renderer/components/LocalizedText";

export function DeleteGameBundleModal({ id, innerProps: { gameBundle } }: ContextModalProps<{ gameBundle: GameBundle }>): React.JSX.Element | null {
    const t = useTranslate();

    const deleteGameBundle = useGameBundleInstallStore((state) => state.delete);

    const [deleteUserdata, setDeleteUserdata] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleClose = useCallback(() => modals.close(id), [id]);

    const handleCheck = useCallback((event: ChangeEvent<HTMLInputElement>) => setDeleteUserdata(event.currentTarget.checked), []);

    const handleDelete = useCallback(async () => {
        if (!gameBundle) return;
        try {
            setDeleting(true);
            setError(null);
            await deleteGameBundle(gameBundle.id, { deleteUserdata });
            handleClose();
        } catch (e) {
            console.error("Can't delete game bundle", e);
            setError(getErrorMessage(e));
        } finally {
            setDeleting(false);
        }
    }, [deleteGameBundle, deleteUserdata, gameBundle, handleClose]);

    useEffect(() => {
        modals.updateModal({
            modalId: id,
            closeOnClickOutside: !deleting,
            closeOnEscape: !deleting,
            withCloseButton: !deleting
        });
    }, [id, deleting]);

    return (
        <Stack gap="md">
            <LocalizedText size="sm" c="dimmed" i18nKey="delete.game.bundle.modal.description" variables={{ version: getReleaseDisplayName(gameBundle) }} />

            <Checkbox size="sm" checked={deleteUserdata} onChange={handleCheck} label={t("versions.option.delete.userdata")} disabled={deleting} />

            {!!error && (
                <Alert variant="light" color="red" title={t("common.error.title")}>
                    <LocalizedText size="sm" i18nKey="common.error.text" variables={{ error }} />
                </Alert>
            )}

            <Group justify="flex-end" gap="xs">
                <Button variant="subtle" onClick={handleClose} disabled={deleting}>
                    {t("common.cancel")}
                </Button>

                <Button color="red" onClick={handleDelete} loading={deleting}>
                    {t("versions.action.delete")}
                </Button>
            </Group>
        </Stack>
    );
}
