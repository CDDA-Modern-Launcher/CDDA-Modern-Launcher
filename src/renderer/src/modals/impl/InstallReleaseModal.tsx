import React, { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getReleaseNameDisplay } from "@renderer/utils/getReleaseNameDisplay";
import { Alert, Button, Card, Checkbox, Group, Progress, Stack, Text } from "@mantine/core";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { ContextModalProps } from "@mantine/modals";
import { GithubRelease } from "../../../../shared/GithubRelease";
import { getErrorMessage } from "../../../../shared/getErrorMessage";
import { useGameBundleInstallStore } from "@renderer/stores/useGameBundleInstallStore";
import { LocalizedText } from "@renderer/components/LocalizedText";
import { getProgressTitle } from "@renderer/utils/getProgressTitle";
import { getIndeterminateProgressValue } from "@renderer/utils/getIndeterminateProgressValue";
import { getProgressDescription } from "@renderer/utils/getProgressDescription";

interface Props {
    release: GithubRelease;
    hasInstalledVersions: boolean;
}

export function InstallReleaseModal({ id, innerProps: { release, hasInstalledVersions }, context }: ContextModalProps<Props>): React.JSX.Element {
    const t = useTranslate();
    const [copyUserdata, setCopyUserdata] = useState(true);
    const [removeOlderGameBundles, setRemoveOlderGameBundles] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const releaseName = useMemo(() => getReleaseNameDisplay(release.name), [release]);

    const installLatestGameBundle = useGameBundleInstallStore((state) => state.installLatest);
    const isInstallingGameBundle = useGameBundleInstallStore((state) => state.isInstalling);

    const handleCopyCheck = useCallback((event: ChangeEvent<HTMLInputElement>) => setCopyUserdata(event.currentTarget.checked), []);

    const handleRemoveCheck = useCallback((event: ChangeEvent<HTMLInputElement>) => setRemoveOlderGameBundles(event.currentTarget.checked), []);

    const handleClose = useCallback(() => context.closeModal(id), [context, id]);

    const handleConfirm = useCallback(async () => {
        try {
            await installLatestGameBundle({ releaseId: release.id, makeActive: true, copyUserdata, removeOlderGameBundles });
            handleClose();
        } catch (e) {
            console.error("Can't install", e);
            setError(getErrorMessage(e));
        }
    }, [copyUserdata, handleClose, installLatestGameBundle, release.id, removeOlderGameBundles]);

    useEffect(() => {
        context.updateModal({
            modalId: id,
            closeOnClickOutside: !isInstallingGameBundle,
            closeOnEscape: !isInstallingGameBundle,
            withCloseButton: !isInstallingGameBundle
        });
    }, [context, id, isInstallingGameBundle]);

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
                    <Checkbox size="sm" checked={copyUserdata} onChange={handleCopyCheck} label={t("install.option.copy.userdata")} disabled={isInstallingGameBundle} />
                    <Checkbox size="sm" checked={removeOlderGameBundles} onChange={handleRemoveCheck} label={t("install.option.remove.old.versions")} disabled={isInstallingGameBundle} />
                </Stack>
            )}

            {!!error && (
                <Alert variant="light" color="red" title={t("common.error.title")}>
                    <LocalizedText size="sm" i18nKey="common.error.text" variables={{ error }} />
                </Alert>
            )}

            <InstallProgress isInstallingGameBundle={isInstallingGameBundle} />

            <Group justify="flex-end" gap="xs">
                <Button variant="subtle" onClick={handleClose} disabled={isInstallingGameBundle}>
                    {t("common.cancel")}
                </Button>

                <Button loading={isInstallingGameBundle} onClick={handleConfirm}>
                    {t("versions.action.install")}
                </Button>
            </Group>
        </Stack>
    );
}

function InstallProgress({ isInstallingGameBundle }: { isInstallingGameBundle: boolean }): React.JSX.Element | null {
    const t = useTranslate();
    const progress = useGameBundleInstallStore((state) => state.progress);

    if (!isInstallingGameBundle) return null;

    const percent = progress.status === "downloading" || progress.status === "extracting" ? progress.percent : null;

    return (
        <Card withBorder radius="md" p="sm">
            <Stack gap="xs">
                <Group justify="space-between" wrap="nowrap">
                    <Text size="sm" fw={700}>
                        {getProgressTitle(progress, t)}
                    </Text>
                    {percent !== null && <Text size="xs">{percent}%</Text>}
                </Group>
                <Progress value={percent ?? getIndeterminateProgressValue(progress)} animated={progress.status !== "completed" && progress.status !== "error"} />
                <Text size="xs" c="dimmed">
                    {getProgressDescription(progress, t)}
                </Text>
            </Stack>
        </Card>
    );
}
