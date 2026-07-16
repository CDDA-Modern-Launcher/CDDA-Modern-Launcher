import type { JSX } from "react";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Group, Stack, TextInput } from "@mantine/core";
import { useModsStore } from "@renderer/stores/useModsStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { LocalizedText } from "@renderer/components/LocalizedText";
import { ContextModalProps, modals } from "@mantine/modals";
import { openModal } from "@renderer/modals/contextModals";

export function AddGitModModal({ id }: ContextModalProps): JSX.Element {
    const t = useTranslate();
    const [gitUrl, setGitUrl] = useState("");
    const error = useModsStore((state) => state.error);
    const setError = useModsStore((state) => state.setError);
    const busyAction = useModsStore((state) => state.busyAction);
    const discoverFromGit = useModsStore((state) => state.discoverFromGit);

    const handleCLose = useCallback(() => modals.close(id), [id]);

    const handleConfirm = useCallback(async () => {
        const result = await discoverFromGit(gitUrl);
        if (result.status === "installed") {
            modals.closeAll();
        } else if (result.status === "selection-required") {
            modals.closeAll();
            openModal("selectMods", t("content.sheet.mods.selection.title"), { sessionId: result.sessionId, mods: result.mods }, { size: result.mods.length > 3 ? "xl" : "md" });
        }
    }, [discoverFromGit, gitUrl, t]);

    useEffect(() => {
        modals.updateModal({
            modalId: id,
            closeOnClickOutside: !busyAction,
            closeOnEscape: !busyAction,
            withCloseButton: !busyAction
        });
    }, [id, busyAction]);

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
                disabled={!!busyAction}
                autoFocus
            />
            {error && (
                <Alert color="red" title={t("content.sheet.mods.install.error.title")}>
                    {error}
                </Alert>
            )}
            <Group justify="flex-end">
                <Button variant="subtle" onClick={handleCLose} disabled={!!busyAction}>
                    {t("common.cancel")}
                </Button>
                <Button onClick={() => void handleConfirm()} disabled={!gitUrl.trim()} loading={!!busyAction}>
                    {t("content.sheet.mods.install.button")}
                </Button>
            </Group>
        </Stack>
    );
}
