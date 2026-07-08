import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getReleaseNameDisplay } from "@renderer/utils/getReleaseNameDisplay";
import { Alert, Button, Checkbox, Group, Stack, Text } from "@mantine/core";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { ContextModalProps } from "@mantine/modals";
import { GithubRelease } from "../../../../shared/GithubRelease";
import { getErrorMessage } from "../../../../shared/getErrorMessage";
import { useGameBundleInstallStore } from "@renderer/stores/useGameBundleInstallStore";
import { LocalizedText } from "@renderer/components/LocalizedText";

interface Props {
    release: GithubRelease;
    hasInstalledVersions: boolean;
}

export function InstallReleaseModal({ id, innerProps: { release, hasInstalledVersions }, context }: ContextModalProps<Props>): React.JSX.Element {
    const t = useTranslate();
    const [installing, setInstalling] = useState(false);
    const [copyUserdata, setCopyUserdata] = useState(true);
    const [removeOlderGameBundles, setRemoveOlderGameBundles] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const releaseName = useMemo(() => getReleaseNameDisplay(release.name), [release]);

    const installLatestGameBundle = useGameBundleInstallStore((state) => state.installLatest);

    const handleClose = useCallback(() => context.closeModal(id), [context, id]);

    const handleConfirm = useCallback(async () => {
        try {
            setInstalling(true);
            await installLatestGameBundle({ releaseId: release.id, makeActive: true, copyUserdata, removeOlderGameBundles });
            handleClose();
        } catch (e) {
            console.error("Can't install", e);
            setError(getErrorMessage(e));
        } finally {
            setInstalling(false);
        }
    }, [copyUserdata, handleClose, installLatestGameBundle, release.id, removeOlderGameBundles]);

    useEffect(() => {
        context.updateModal({
            modalId: id,
            closeOnClickOutside: !installing,
            closeOnEscape: !installing,
            withCloseButton: !installing
        });
    }, [context, id, installing]);

    return (
        <Stack gap="md">
            <Stack gap={4}>
                <LocalizedText size="sm" c="dimmed" i18nKey="install.modal.description" variables={{ version: releaseName }} />

                <Text size="xs" c="dimmed">
                    {release?.asset?.name}
                </Text>
            </Stack>

            {hasInstalledVersions && (
                <Stack gap="xs" className="game-bundle-options">
                    <Checkbox size="sm" checked={copyUserdata} onChange={(event) => setCopyUserdata(event.currentTarget.checked)} label={t("install.option.copy.userdata")} />

                    <Checkbox size="sm" checked={removeOlderGameBundles} onChange={(event) => setRemoveOlderGameBundles(event.currentTarget.checked)} label={t("install.option.remove.old.versions")} />
                </Stack>
            )}

            {!!error && (
                <Alert variant="light" color="red" title={t("common.error.title")}>
                    <LocalizedText size="sm" i18nKey="common.error.text" variables={{ error }} />
                </Alert>
            )}

            <Group justify="flex-end" gap="xs">
                <Button variant="subtle" onClick={handleClose} disabled={installing}>
                    {t("common.cancel")}
                </Button>

                <Button loading={installing} onClick={handleConfirm}>
                    {t("versions.action.install")}
                </Button>
            </Group>
        </Stack>
    );
}
