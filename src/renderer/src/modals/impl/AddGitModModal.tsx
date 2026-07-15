import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, Group, Stack, TextInput } from "@mantine/core";
import { useModsStore } from "@renderer/stores/useModsStore";
import { useWorkspaceStore } from "@renderer/stores/useWorkspaceStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { LocalizedText } from "@renderer/components/LocalizedText";
import { ContextModalProps, modals } from "@mantine/modals";

export function AddGitModModalNew({ id, context }: ContextModalProps): React.JSX.Element {
    const t = useTranslate();
    const [gitUrl, setGitUrl] = useState("");

    const repository = useWorkspaceStore((state) => state.workspaceStatus);

    const error = useModsStore((state) => state.error);
    const setError = useModsStore((state) => state.setError);
    const busyAction = useModsStore((state) => state.busyAction);
    const repoStatus = useModsStore((state) => state.state.status);
    const installModFromGit = useModsStore((state) => state.installModFromGit);

    const isRepositoryReady = repository.status === "ready" && repoStatus === "ready";

    const handleClose = useCallback(() => context.closeModal(id), [context, id]);

    const handleConfirm = useCallback(async () => {
        try {
            await installModFromGit(gitUrl);
            modals.closeAll();
        } catch (e) {
            console.error("Can't install mod", e);
        }
    }, [installModFromGit, gitUrl]);

    useEffect(() => {
        context.updateModal({
            modalId: id,
            closeOnClickOutside: !busyAction,
            closeOnEscape: !busyAction,
            withCloseButton: !busyAction
        });
    }, [context, id, busyAction]);

    return (
        <Stack gap="md">
            <LocalizedText size="sm" c="dimmed" i18nKey="content.sheet.mods.git.modal.description" />

            <TextInput
                label={t("content.sheet.mods.url.label")}
                description={<LocalizedText size="xs" i18nKey="content.sheet.mods.url.description" />}
                placeholder={t("content.sheet.mods.url.placeholder")}
                value={gitUrl}
                onChange={(event) => {
                    setGitUrl(event.currentTarget.value);
                    setError(null);
                }}
                disabled={!isRepositoryReady || !!busyAction}
                autoFocus
            />

            {!!error && (
                <Alert variant="light" color="red" title={t("content.sheet.mods.install.error.title")}>
                    {error}
                </Alert>
            )}

            <Group justify="flex-end">
                <Button variant="subtle" onClick={handleClose} disabled={!!busyAction}>
                    {t("common.cancel")}
                </Button>
                <Button onClick={handleConfirm} disabled={!isRepositoryReady || gitUrl.trim().length === 0} loading={!!busyAction}>
                    {t("content.sheet.mods.install.button")}
                </Button>
            </Group>
        </Stack>
    );
}
