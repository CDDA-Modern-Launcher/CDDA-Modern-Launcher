import React, { useCallback, useState } from "react";
import { defaultModalProps } from "@renderer/DefaultModalProps";
import { Alert, Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { useModalClose } from "@renderer/modals/useModalStore";
import { useModsStore } from "@renderer/stores/useModsStore";
import { useWorkspaceStore } from "@renderer/stores/useWorkspaceStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";

interface Props {
    opened: boolean;
}

export function AddGitModModal({ opened }: Props): React.JSX.Element {
    const t = useTranslate();
    const close = useModalClose();

    return (
        <Modal {...defaultModalProps} opened={opened} onClose={close} title={t("contentSheet.mods.gitModal.title")}>
            <Content onClose={close} key={String(opened)} />
        </Modal>
    );
}

interface ContentProps {
    onClose: () => void;
}

function Content({ onClose }: ContentProps): React.JSX.Element {
    const t = useTranslate();

    const [gitUrl, setGitUrl] = useState("");

    const repository = useWorkspaceStore((state) => state.workspaceStatus);

    const error = useModsStore((state) => state.error);
    const setError = useModsStore((state) => state.setError);
    const busyAction = useModsStore((state) => state.busyAction);
    const repoStatus = useModsStore((state) => state.state.status);
    const installModFn = useModsStore((state) => state.installModFromGit);

    const isRepositoryReady = repository.status === "ready" && repoStatus === "ready";

    const handleConfirmClick = useCallback(async () => {
        try {
            await installModFn(gitUrl);
            onClose();
        } catch (e) {
            console.log("Cannot install mod from git", e);
        }
    }, [gitUrl, installModFn, onClose]);

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
                disabled={!isRepositoryReady || busyAction === "install"}
                autoFocus
            />
            {!!error && (
                <Alert variant="light" color="red" title={t("contentSheet.mods.install.errorTitle")}>
                    {error}
                </Alert>
            )}
            <Group justify="flex-end">
                <Button variant="subtle" onClick={onClose} disabled={busyAction === "install"}>
                    {t("common.cancel")}
                </Button>
                <Button onClick={handleConfirmClick} disabled={!isRepositoryReady || gitUrl.trim().length === 0 || busyAction === "install"} loading={busyAction === "install"}>
                    {t("contentSheet.mods.install.button")}
                </Button>
            </Group>
        </Stack>
    );
}
