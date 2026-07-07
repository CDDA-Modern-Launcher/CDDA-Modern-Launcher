import { GithubRelease } from "../../../shared/GithubRelease";
import type React from "react";
import { Badge, Button, Card, Group, Stack, Text } from "@mantine/core";
import { getReleaseNameDisplay } from "@renderer/utils/getReleaseNameDisplay";
import { formatDate } from "@renderer/utils/formatDate";
import { toReleaseNotesTarget } from "@renderer/utils/toReleaseNotesTarget";
import { useModalOpen } from "@renderer/modals/useModalStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";

interface Props {
    release: GithubRelease;
    isGameBundleReady: boolean;
    isInstallingGameBundle: boolean;
    actionDisabled: boolean;
    onRequestInstall: (release: GithubRelease) => void;
}

export function GameBundleReleaseCard({ release, isGameBundleReady, isInstallingGameBundle, actionDisabled, onRequestInstall }: Props): React.JSX.Element {
    const t = useTranslate();

    const openModal = useModalOpen();

    return (
        <Card withBorder radius="md" p="sm" className="version-card">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={2}>
                    <Group gap="xs">
                        <Text fw={700}>{getReleaseNameDisplay(release.name)}</Text>
                        {isGameBundleReady && <Badge variant="light">{t("versions.badge.installed")}</Badge>}
                    </Group>
                    <Text size="xs" c="dimmed">
                        {t("versions.available.publishedAt", { date: formatDate(release.publishedAt) })}
                    </Text>
                    <Text size="xs" c="dimmed">
                        {release.asset.name}
                    </Text>
                </Stack>
                <Group gap="xs" wrap="nowrap">
                    <Button size="xs" variant="subtle" onClick={() => openModal({ kind: "release-notes", notes: toReleaseNotesTarget(release) })}>
                        {t("versions.action.showChanges")}
                    </Button>
                    <Button size="xs" disabled={isGameBundleReady || actionDisabled} loading={isInstallingGameBundle} onClick={() => onRequestInstall(release)}>
                        {isGameBundleReady ? t("versions.action.installed") : t("versions.action.install")}
                    </Button>
                </Group>
            </Group>
        </Card>
    );
}
