import { Alert, Button, Card, Checkbox, Group, Modal, Progress, Stack, Text, Title } from "@mantine/core";
import type React from "react";

import { useLocalization } from "../../localization/LocalizationContext";
import { getIndeterminateProgressValue, getProgressDescription, getProgressTitle, getReleaseNameDisplay } from "./homeUtils";
import { APP_MODAL_PROPS } from "./modalProps";
import { GithubRelease } from "../../../../shared/GithubRelease";
import { InstallDistributiveProgress } from "../../../../shared/distributive/InstallDistributiveProgress";

type InstallPromptProps = {
    description: string;
    installLabel: string;
    loading: boolean;
    disabled: boolean;
    onInstall: () => void;
    onOpenVersions: () => void;
};

export function InstallPrompt(props: InstallPromptProps): React.JSX.Element {
    const { t } = useLocalization();
    return (
        <Alert variant="light" color="blue" title={t("home.install.title")}>
            <Stack gap="sm">
                <Text size="sm">{props.description}</Text>
                <Group gap="xs">
                    <Button size="xs" loading={props.loading} disabled={props.disabled} onClick={props.onInstall}>
                        {props.installLabel}
                    </Button>
                    <Button size="xs" variant="subtle" onClick={props.onOpenVersions}>
                        {t("home.action.chooseVersion")}
                    </Button>
                </Group>
            </Stack>
        </Alert>
    );
}

export function InstallOptionsModal(props: {
    opened: boolean;
    release: GithubRelease | null;
    hasInstalledVersions: boolean;
    copyUserdata: boolean;
    removeOldVersions: boolean;
    isInstalling: boolean;
    onCopyUserdata: (value: boolean) => void;
    onRemoveOldVersions: (value: boolean) => void;
    onCancel: () => void;
    onConfirm: () => void;
}): React.JSX.Element {
    const { t } = useLocalization();
    const releaseName = props.release === null ? "" : getReleaseNameDisplay(props.release.name);
    return (
        <Modal {...APP_MODAL_PROPS} opened={props.opened} onClose={props.onCancel} title={<Title order={4}>{t("install.modal.title")}</Title>}>
            <Stack gap="md">
                <Stack gap={4}>
                    <Text size="sm" c="dimmed">
                        {t("install.modal.description", { version: releaseName })}
                    </Text>
                    {props.release !== null && (
                        <Text size="xs" c="dimmed">
                            {props.release.asset.name}
                        </Text>
                    )}
                </Stack>
                {props.hasInstalledVersions && (
                    <Stack gap="xs" className="install-options">
                        <Checkbox size="sm" checked={props.copyUserdata} onChange={(event) => props.onCopyUserdata(event.currentTarget.checked)} label={t("install.option.copyUserdata")} />
                        <Checkbox size="sm" checked={props.removeOldVersions} onChange={(event) => props.onRemoveOldVersions(event.currentTarget.checked)} label={t("install.option.removeOldVersions")} />
                    </Stack>
                )}
                <Group justify="flex-end" gap="xs">
                    <Button variant="subtle" onClick={props.onCancel}>
                        {t("common.cancel")}
                    </Button>
                    <Button loading={props.isInstalling} onClick={props.onConfirm}>
                        {t("versions.action.install")}
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}

export function InstallProgressCard({ progress }: { progress: InstallDistributiveProgress }): React.JSX.Element {
    const { t } = useLocalization();
    const percent = progress.status === "downloading" || progress.status === "extracting" ? progress.percent : null;
    return (
        <Card withBorder radius="md" p="sm" className="install-progress-card">
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
