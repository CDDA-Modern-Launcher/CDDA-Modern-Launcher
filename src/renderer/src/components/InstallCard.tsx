import { Distributive } from "../../../shared/distributive/Distributive";
import { GithubRelease } from "../../../shared/GithubRelease";
import type React from "react";
import { Badge, Button, Card, Group, Stack, Text } from "@mantine/core";
import { getReleaseDisplayName } from "@renderer/utils/getReleaseDisplayName";
import { formatDate } from "@renderer/utils/formatDate";
import { toInstalledReleaseNotesTarget } from "@renderer/utils/toInstalledReleaseNotesTarget";
import { useModalOpen } from "@renderer/modals/useModalStore";
import { useTranslate } from "@renderer/localization/useLocaleStore";

interface Props {
    distributive: Distributive;
    release: GithubRelease | null;
    onSetActive: (installId: string) => Promise<void>;
    onConfirmDelete: (distributiveId: Distributive, deleteUserdata: boolean) => void;
}

export function InstallCard({ distributive, release, onSetActive, onConfirmDelete }: Props): React.JSX.Element {
    const t = useTranslate();

    const openModal = useModalOpen();

    const onDeleteClick = (): void => openModal({ kind: "delete-install", distributive: distributive, onConfirm: (install, deleteUserdata) => onConfirmDelete(install, deleteUserdata) });

    return (
        <Card withBorder radius="md" p="sm" className="version-card">
            <Stack gap="xs">
                <Stack gap={2}>
                    <Group gap="xs">
                        <Text fw={700}>{getReleaseDisplayName(distributive)}</Text>
                        {distributive.isActive && <Badge variant="light">{t("versions.badge.active")}</Badge>}
                    </Group>
                    <Text size="xs" c="dimmed">
                        {t("versions.installed.installedAt", { date: formatDate(distributive.manifest.installedAt) })}
                    </Text>
                    <Text size="xs" c="dimmed">
                        {t("versions.installed.saves")}
                    </Text>
                </Stack>
                <Group gap="xs">
                    {!distributive.isActive && (
                        <Button size="xs" variant="light" onClick={() => void onSetActive(distributive.id)}>
                            {t("versions.action.makeActive")}
                        </Button>
                    )}
                    <Button size="xs" variant="subtle" onClick={() => void window.api.game.openInstallFolder(distributive.id)}>
                        {t("versions.action.openInstallFolder")}
                    </Button>
                    <Button size="xs" variant="subtle" onClick={() => void window.api.game.openSavesFolder(distributive.id)}>
                        {t("versions.action.openSavesFolder")}
                    </Button>
                    <Button size="xs" variant="subtle" onClick={() => openModal({ kind: "release-notes", notes: toInstalledReleaseNotesTarget(distributive, release) })}>
                        {t("versions.action.showChanges")}
                    </Button>
                    <Button size="xs" variant="subtle" disabled={distributive.isActive} color="red" onClick={onDeleteClick}>
                        {t("versions.action.delete")}
                    </Button>
                </Group>
            </Stack>
        </Card>
    );
}
