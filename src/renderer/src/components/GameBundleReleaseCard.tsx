import { GithubRelease } from "../../../shared/GithubRelease";
import React, { useCallback } from "react";
import { Badge, Button, Card, Group, Stack, Text } from "@mantine/core";
import { getReleaseNameDisplay } from "@renderer/utils/getReleaseNameDisplay";
import { formatDate } from "@renderer/utils/formatDate";
import { toReleaseNotesTarget } from "@renderer/utils/toReleaseNotesTarget";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { openModal } from "@renderer/modals/contextModals";
import { LocalizedText } from "@renderer/components/LocalizedText";

interface Props {
    release: GithubRelease;
    isGameBundleReady: boolean;
    isInstallingGameBundle: boolean;
    actionDisabled: boolean;
    onRequestInstall: (release: GithubRelease) => void;
}

export function GameBundleReleaseCard({ release, isGameBundleReady, isInstallingGameBundle, actionDisabled, onRequestInstall }: Props): React.JSX.Element {
    const t = useTranslate();
    const openReleaseNotesModal = useCallback(() => openModal("showReleaseNotes", t("release.notes.modal.title"), { notes: toReleaseNotesTarget(release) }), [release, t]);

    return (
        <Card withBorder radius="md" p="sm" className="version-card">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={2}>
                    <Group gap="xs">
                        <Text fw={700}>{getReleaseNameDisplay(release.name)}</Text>
                        {isGameBundleReady && <Badge variant="light">{t("versions.badge.installed")}</Badge>}
                    </Group>
                    <LocalizedText size="xs" c="dimmed" i18nKey="versions.available.published.at" variables={{ date: formatDate(release.publishedAt) }} />
                    <Text size="xs" c="dimmed">
                        {release.asset.name}
                    </Text>
                </Stack>
                <Group gap="xs" wrap="nowrap">
                    <Button size="xs" variant="subtle" onClick={openReleaseNotesModal}>
                        {t("versions.action.show.changes")}
                    </Button>
                    <Button size="xs" disabled={isGameBundleReady || actionDisabled} loading={isInstallingGameBundle} onClick={() => onRequestInstall(release)}>
                        {isGameBundleReady ? t("versions.action.installed") : t("versions.action.install")}
                    </Button>
                </Group>
            </Group>
        </Card>
    );
}
