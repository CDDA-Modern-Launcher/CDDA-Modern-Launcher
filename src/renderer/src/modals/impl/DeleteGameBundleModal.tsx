import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, Checkbox, Group, Stack, Text } from "@mantine/core";
import { getReleaseDisplayName } from "@renderer/utils/getReleaseDisplayName";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useGameBundleInstallStore } from "@renderer/stores/useGameBundleInstallStore";
import { getErrorMessage } from "../../../../shared/getErrorMessage";
import { ContextModalProps } from "@mantine/modals";
import { GameBundle } from "../../../../shared/game-bundle/GameBundle";

export function DeleteGameBundleModal({ id, innerProps: { gameBundle }, context }: ContextModalProps<{ gameBundle: GameBundle }>): React.JSX.Element | null {
    const t = useTranslate();

    const deleteGameBundle = useGameBundleInstallStore((state) => state.delete);

    const [deleteUserdata, setDeleteUserdata] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleClose = useCallback(() => context.closeModal(id), [context, id]);

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
        context.updateModal({
            modalId: id,
            closeOnClickOutside: !deleting,
            closeOnEscape: !deleting,
            withCloseButton: !deleting
        });
    }, [context, id, deleting]);

    return (
        <Stack gap="md">
            <Text size="sm" c="dimmed">
                {t("deleteGameBundle.modal.description", { version: getReleaseDisplayName(gameBundle) })}
            </Text>

            <Checkbox size="sm" checked={deleteUserdata} onChange={(event) => setDeleteUserdata(event.currentTarget.checked)} label={t("versions.option.deleteUserdata")} />

            {!!error && (
                <Alert variant="light" color="red" title={t("common.error.title")}>
                    <Text size="sm">{t("common.error.text", { error })}</Text>
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
