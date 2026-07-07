import { GithubRelease } from "../../../shared/GithubRelease";
import type React from "react";
import { useLocalization } from "@renderer/localization/LocalizationContext";
import { Badge, Button, Card, Group, Stack, Text } from "@mantine/core";
import { getReleaseNameDisplay } from "@renderer/utils/getReleaseNameDisplay";
import { formatDate } from "@renderer/utils/formatDate";
import { toReleaseNotesTarget } from "@renderer/utils/toReleaseNotesTarget";
import { useModalOpen } from "@renderer/modals/useModalStore";

interface Props {
    release: GithubRelease;
    isInstalled: boolean;
    isInstalling: boolean;
    onRequestInstall: (release: GithubRelease) => void;
}

export function DistributiveReleaseCard({ release, isInstalled, isInstalling, onRequestInstall }: Props): React.JSX.Element {
    const { t } = useLocalization();

    const openModal = useModalOpen();

    return (
        <Card withBorder radius="md" p="sm" className="version-card">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={2}>
                    <Group gap="xs">
                        <Text fw={700}>{getReleaseNameDisplay(release.name)}</Text>
                        {isInstalled && <Badge variant="light">{t("versions.badge.installed")}</Badge>}
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
                    <Button size="xs" disabled={isInstalled} loading={isInstalling} onClick={() => onRequestInstall(release)}>
                        {isInstalled ? t("versions.action.installed") : t("versions.action.install")}
                    </Button>
                </Group>
            </Group>
        </Card>
    );
}
