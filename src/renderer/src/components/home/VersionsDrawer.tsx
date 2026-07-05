import { ActionIcon, Anchor, Badge, Box, Button, Card, Checkbox, Divider, Drawer, Group, Loader, Modal, Stack, Text, Title, Tooltip } from "@mantine/core";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { localizeChannelName } from "../../localization/channelLabels";
import { useLocalization } from "../../localization/LocalizationContext";
import { formatDate, getReleaseDisplayName, getReleaseNameDisplay, type ReleaseNotesTarget, toInstalledReleaseNotesTarget, toReleaseNotesTarget } from "./homeUtils";
import { APP_MODAL_PROPS } from "./modalProps";
import { GithubRelease } from "../../../../shared/GithubRelease";
import { Distributive } from "../../../../shared/distributive/Distributive";
import { DistributiveState } from "../../../../shared/distributive/DistributiveState";

export function VersionsDrawer({
    opened,
    state,
    installedIds,
    isInstalling,
    onClose,
    onRefresh,
    onRequestInstall,
    onSetActive,
    onDelete
}: {
    opened: boolean;
    state: DistributiveState;
    installedIds: Set<string>;
    isInstalling: boolean;
    onClose: () => void;
    onRefresh: () => Promise<void>;
    onRequestInstall: (release: GithubRelease) => void;
    onSetActive: (installId: string) => Promise<void>;
    onDelete: (installId: string, deleteUserdata: boolean) => Promise<void>;
}): React.JSX.Element {
    const { t } = useLocalization();
    const [releases, setReleases] = useState<GithubRelease[]>([]);
    const [isLoadingReleases, setLoadingReleases] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Distributive | null>(null);
    const [releaseNotesTarget, setReleaseNotesTarget] = useState<ReleaseNotesTarget | null>(null);
    const releaseById = useMemo(() => new Map(releases.map((release) => [release.id, release])), [releases]);
    const channelId = state.status === "ready" ? state.channel.id : "";

    const loadReleases = useCallback(async (forceRefresh = false): Promise<void> => {
        setLoadingReleases(true);
        try {
            setReleases(await window.api.game.getReleases(forceRefresh));
        } catch (error) {
            console.error("Failed to load releases", error);
        } finally {
            setLoadingReleases(false);
        }
    }, []);

    const refreshDrawer = async (): Promise<void> => {
        await Promise.all([onRefresh(), loadReleases(true)]);
    };

    useEffect(() => {
        if (!opened) return;
        queueMicrotask(() => void loadReleases());
    }, [opened, channelId, loadReleases]);

    return (
        <>
            <Drawer
                opened={opened}
                onClose={onClose}
                position="right"
                size={560}
                title={
                    <Group gap="xs" wrap="nowrap">
                        <Title order={3}>{t("versions.title")}</Title>
                        <Tooltip label={t("versions.action.refreshTooltip")}>
                            <ActionIcon variant="subtle" aria-label={t("versions.action.refreshTooltip")} loading={isLoadingReleases} onClick={() => void refreshDrawer()}>
                                ↻
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                }
            >
                <Stack gap="lg">
                    <Text size="sm" c="dimmed">
                        {state.status === "ready" ? t("versions.description", { channel: `${state.channel.shortName} · ${localizeChannelName(state.channel.channelName, t)}` }) : t("versions.description.unavailable")}
                    </Text>
                    <Stack gap="sm">
                        <Title order={4}>{t("versions.installed.title")}</Title>
                        {state.status !== "ready" || state.distributives.length === 0 ? (
                            <Text size="sm" c="dimmed">
                                {t("versions.installed.empty")}
                            </Text>
                        ) : (
                            state.distributives.map((install) => (
                                <InstallCard
                                    key={install.id}
                                    install={install}
                                    release={releaseById.get(install.id) ?? null}
                                    onSetActive={onSetActive}
                                    onRequestDelete={setDeleteTarget}
                                    onShowReleaseNotes={setReleaseNotesTarget}
                                />
                            ))
                        )}
                    </Stack>
                    <Divider />
                    <Stack gap="sm">
                        <Group justify="space-between">
                            <Title order={4}>{t("versions.available.title")}</Title>
                            {isLoadingReleases && <Loader size="sm" />}
                        </Group>
                        <Stack gap="sm">
                            {releases.length === 0 && !isLoadingReleases ? (
                                <Text size="sm" c="dimmed">
                                    {t("versions.available.empty")}
                                </Text>
                            ) : (
                                releases.map((release) => (
                                    <ReleaseCard
                                        key={release.id}
                                        release={release}
                                        isInstalled={installedIds.has(release.id)}
                                        isInstalling={isInstalling}
                                        onRequestInstall={onRequestInstall}
                                        onShowReleaseNotes={setReleaseNotesTarget}
                                    />
                                ))
                            )}
                        </Stack>
                    </Stack>
                </Stack>
            </Drawer>
            <DeleteInstallModal
                key={deleteTarget?.id ?? "empty"}
                install={deleteTarget}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={(installId, deleteUserdata) => {
                    setDeleteTarget(null);
                    void onDelete(installId, deleteUserdata);
                }}
            />
            <ReleaseNotesModal target={releaseNotesTarget} onClose={() => setReleaseNotesTarget(null)} />
        </>
    );
}

function InstallCard({
    install,
    release,
    onSetActive,
    onRequestDelete,
    onShowReleaseNotes
}: {
    install: Distributive;
    release: GithubRelease | null;
    onSetActive: (installId: string) => Promise<void>;
    onRequestDelete: (install: Distributive) => void;
    onShowReleaseNotes: (target: ReleaseNotesTarget) => void;
}): React.JSX.Element {
    const { t } = useLocalization();
    return (
        <Card withBorder radius="md" p="sm" className="version-card">
            <Stack gap="xs">
                <Stack gap={2}>
                    <Group gap="xs">
                        <Text fw={700}>{getReleaseDisplayName(install)}</Text>
                        {install.isActive && <Badge variant="light">{t("versions.badge.active")}</Badge>}
                    </Group>
                    <Text size="xs" c="dimmed">
                        {t("versions.installed.installedAt", { date: formatDate(install.manifest.installedAt) })}
                    </Text>
                    <Text size="xs" c="dimmed">
                        {t("versions.installed.saves")}
                    </Text>
                </Stack>
                <Group gap="xs">
                    {!install.isActive && (
                        <Button size="xs" variant="light" onClick={() => void onSetActive(install.id)}>
                            {t("versions.action.makeActive")}
                        </Button>
                    )}
                    <Button size="xs" variant="subtle" onClick={() => void window.api.game.openInstallFolder(install.id)}>
                        {t("versions.action.openInstallFolder")}
                    </Button>
                    <Button size="xs" variant="subtle" onClick={() => void window.api.game.openSavesFolder(install.id)}>
                        {t("versions.action.openSavesFolder")}
                    </Button>
                    <Button size="xs" variant="subtle" onClick={() => onShowReleaseNotes(toInstalledReleaseNotesTarget(install, release))}>
                        {t("versions.action.showChanges")}
                    </Button>
                    <Button size="xs" variant="subtle" disabled={install.isActive} color="red" onClick={() => onRequestDelete(install)}>
                        {t("versions.action.delete")}
                    </Button>
                </Group>
            </Stack>
        </Card>
    );
}

function ReleaseCard({
    release,
    isInstalled,
    isInstalling,
    onRequestInstall,
    onShowReleaseNotes
}: {
    release: GithubRelease;
    isInstalled: boolean;
    isInstalling: boolean;
    onRequestInstall: (release: GithubRelease) => void;
    onShowReleaseNotes: (target: ReleaseNotesTarget) => void;
}): React.JSX.Element {
    const { t } = useLocalization();
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
                    <Button size="xs" variant="subtle" onClick={() => onShowReleaseNotes(toReleaseNotesTarget(release))}>
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

function DeleteInstallModal({ install, onCancel, onConfirm }: { install: Distributive | null; onCancel: () => void; onConfirm: (installId: string, deleteUserdata: boolean) => void }): React.JSX.Element {
    const { t } = useLocalization();
    const [deleteUserdata, setDeleteUserdata] = useState(true);

    return (
        <Modal {...APP_MODAL_PROPS} opened={install !== null} onClose={onCancel} title={<Title order={4}>{t("deleteInstall.modal.title")}</Title>}>
            <Stack gap="md">
                <Text size="sm" c="dimmed">
                    {install === null ? "" : t("deleteInstall.modal.description", { version: getReleaseDisplayName(install) })}
                </Text>
                <Checkbox size="sm" checked={deleteUserdata} onChange={(event) => setDeleteUserdata(event.currentTarget.checked)} label={t("versions.option.deleteUserdata")} />
                <Group justify="flex-end" gap="xs">
                    <Button variant="subtle" onClick={onCancel}>
                        {t("common.cancel")}
                    </Button>
                    <Button color="red" onClick={() => install !== null && onConfirm(install.id, deleteUserdata)}>
                        {t("versions.action.delete")}
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}

export function ReleaseNotesModal({ target, onClose }: { target: ReleaseNotesTarget | null; onClose: () => void }): React.JSX.Element {
    const { t } = useLocalization();
    const body = target?.body.trim() ?? "";
    return (
        <Modal {...APP_MODAL_PROPS} opened={target !== null} onClose={onClose} title={<Title order={4}>{target?.title ?? t("releaseNotes.modal.title")}</Title>} size="xl">
            <Stack gap="md">
                {target !== null && (target.publishedAt !== undefined || target.htmlUrl !== undefined) && (
                    <Group gap="xs">
                        {target.publishedAt !== undefined && (
                            <Text size="xs" c="dimmed">
                                {t("releaseNotes.modal.publishedAt", { date: formatDate(target.publishedAt) })}
                            </Text>
                        )}
                        {target.htmlUrl !== undefined && (
                            <Anchor size="xs" component="button" type="button" onClick={() => void window.api.shell.openExternal(target.htmlUrl!)}>
                                {t("releaseNotes.modal.openOnGithub")}
                            </Anchor>
                        )}
                    </Group>
                )}
                {body.length === 0 ? (
                    <Text size="sm" c="dimmed">
                        {t("releaseNotes.modal.empty")}
                    </Text>
                ) : (
                    <Box component="pre" className="release-notes-text">
                        {body}
                    </Box>
                )}
            </Stack>
        </Modal>
    );
}
