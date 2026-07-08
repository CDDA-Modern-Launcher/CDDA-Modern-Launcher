import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { useModsStore } from "@renderer/stores/useModsStore";
import { useWorkspaceStore } from "@renderer/stores/useWorkspaceStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { ContextModalProps } from "@mantine/modals";

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
            <Text size="sm" c="dimmed">
                {t("contentSheet.mods.gitModal.description")}
            </Text>

            <TextInput
                label={t("contentSheet.mods.url.label")}
                description={t("contentSheet.mods.url.description")}
                placeholder={t("contentSheet.mods.url.placeholder")}
                value={gitUrl}
                onChange={(event) => {
                    setGitUrl(event.currentTarget.value);
                    setError(null);
                }}
                disabled={!isRepositoryReady || !!busyAction}
                autoFocus
            />

            {!!error && (
                <Alert variant="light" color="red" title={t("contentSheet.mods.install.errorTitle")}>
                    {error}
                </Alert>
            )}

            <Group justify="flex-end">
                <Button variant="subtle" onClick={handleClose} disabled={!!busyAction}>
                    {t("common.cancel")}
                </Button>
                <Button onClick={handleConfirm} disabled={!isRepositoryReady || gitUrl.trim().length === 0} loading={!!busyAction}>
                    {t("contentSheet.mods.install.button")}
                </Button>
            </Group>
        </Stack>
    );
}
