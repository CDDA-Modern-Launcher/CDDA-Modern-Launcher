import { ActionIcon, Alert, Badge, Button, Card, Divider, Drawer, Group, Menu, Modal, Stack, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import React, { useEffect, useMemo, useState } from "react";

import { findGameChannel, getEffectiveGameChannels } from "../../../../shared/gameChannels";
import { InstallModResult, ModRepositoryItem, ModRepositoryNoticeEvent, ModRepositoryState, UpdateModResult } from "../../../../shared/modRepository";
import { RepositoryStatus } from "../../../../shared/repository";
import { useLocalization } from "../../localization/LocalizationContext";

export type ContentSheetKind = "mods" | "soundpack" | "tileset";

type ContentSheetProps = {
    repository: RepositoryStatus;
    kind: ContentSheetKind | null;
    onClose: () => void;
};

export function ContentSheet({ repository, kind, onClose }: ContentSheetProps): React.JSX.Element {
    const { t } = useLocalization();
    const opened = kind !== null;
    const effectiveKind = kind ?? "mods";
    const selectedChannel = repository.status === "ready" ? findGameChannel(getEffectiveGameChannels(repository.config.customChannels), repository.config.selectedChannelId) : null;
    const selectedChannelName = selectedChannel === null ? null : `${selectedChannel.gameName} · ${selectedChannel.channelName}`;

    return (
        <Drawer
            opened={opened}
            onClose={onClose}
            position="right"
            size={520}
            title={<Title order={3}>{t(contentTitleKeyByKind[effectiveKind])}</Title>}
        >
            {effectiveKind === "mods" ? <ModsContent repository={repository} selectedChannelName={selectedChannelName} /> : <PlaceholderContent kind={effectiveKind} selectedChannelName={selectedChannelName} />}
        </Drawer>
    );
}

function ModsContent({ repository, selectedChannelName }: { repository: RepositoryStatus; selectedChannelName: string | null }): React.JSX.Element {
    const { t } = useLocalization();
    const [state, setState] = useState<ModRepositoryState>({ status: "unconfigured", mods: [], checking: false });
    const [isGitModalOpen, setIsGitModalOpen] = useState(false);
    const [gitUrl, setGitUrl] = useState("");
    const [gitError, setGitError] = useState<string | null>(null);
    const [mainError, setMainError] = useState<string | null>(null);
    const [busyAction, setBusyAction] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        window.api.mods.getState().then((nextState) => {
            if (mounted) {
                setState(nextState);
            }
        });

        const unsubscribeChanged = window.api.mods.onChanged((event) => {
            setState(event.state);
        });
        const unsubscribeNotice = window.api.mods.onNotice((event: ModRepositoryNoticeEvent) => {
            setState(event.state);
        });

        return () => {
            mounted = false;
            unsubscribeChanged();
            unsubscribeNotice();
        };
    }, []);

    useEffect(() => {
        window.api.mods.getState().then(setState).catch((error) => console.error("Failed to load mods state", error));
    }, [repository]);

    const sortedMods = useMemo(() => [...state.mods].sort(compareMods), [state.mods]);

    const installGitMod = async (): Promise<void> => {
        setBusyAction("install");
        setGitError(null);
        setMainError(null);

        try {
            const result: InstallModResult = await window.api.mods.installFromUrl(gitUrl);
            setState(result.state);

            if (result.status === "installed") {
                setGitUrl("");
                setIsGitModalOpen(false);
                return;
            }

            setGitError(result.message);
        } catch (error) {
            setGitError(error instanceof Error ? error.message : String(error));
        } finally {
            setBusyAction(null);
        }
    };

    const checkUpdates = async (): Promise<void> => {
        setBusyAction("check");
        setMainError(null);

        try {
            const result = await window.api.mods.checkUpdates();
            setState(result.state);

            if (result.status !== "checked") {
                setMainError(result.message);
            }
        } catch (error) {
            setMainError(error instanceof Error ? error.message : String(error));
        } finally {
            setBusyAction(null);
        }
    };

    const updateMod = async (mod: ModRepositoryItem, force = false): Promise<void> => {
        setBusyAction(`update:${mod.id}`);
        setMainError(null);

        try {
            const result: UpdateModResult = await window.api.mods.update(mod.id, { force });
            setState(result.state);

            if (result.status === "updated") {
                return;
            }

            if (result.status === "blocked-by-local-changes") {
                setMainError(t("contentSheet.mods.update.blockedDescription", { name: result.mod.displayName }));
                return;
            }

            setMainError(result.message);
        } catch (error) {
            setMainError(error instanceof Error ? error.message : String(error));
        } finally {
            setBusyAction(null);
        }
    };

    const forceUpdateMod = (mod: ModRepositoryItem): Promise<void> => {
        modals.openConfirmModal({
            title: t("contentSheet.mods.update.forceConfirmTitle"),
            children: <Text size="sm">{t("contentSheet.mods.update.forceConfirm", { name: mod.displayName })}</Text>,
            labels: { confirm: t("common.update"), cancel: t("common.cancel") },
            confirmProps: { color: "red" },
            onConfirm: () => {
                void updateMod(mod, true);
            }
        });

        return Promise.resolve();
    };

    const removeMod = (mod: ModRepositoryItem): Promise<void> => {
        modals.openConfirmModal({
            title: t("contentSheet.mods.remove.confirmTitle"),
            children: <Text size="sm">{t("contentSheet.mods.remove.confirm", { name: mod.displayName })}</Text>,
            labels: { confirm: t("common.delete"), cancel: t("common.cancel") },
            confirmProps: { color: "red" },
            onConfirm: () => {
                void removeModConfirmed(mod);
            }
        });

        return Promise.resolve();
    };

    const removeModConfirmed = async (mod: ModRepositoryItem): Promise<void> => {
        setBusyAction(`remove:${mod.id}`);
        setMainError(null);

        try {
            const result = await window.api.mods.remove(mod.id);
            setState(result.state);

            if (result.status !== "removed") {
                setMainError(result.message);
            }
        } catch (error) {
            setMainError(error instanceof Error ? error.message : String(error));
        } finally {
            setBusyAction(null);
        }
    };

    const openFolder = async (mod?: ModRepositoryItem): Promise<void> => {
        const result = await window.api.mods.openFolder(mod?.id);

        if (result.status === "error") {
            setMainError(result.message);
        }
    };

    const isRepositoryReady = repository.status === "ready" && state.status === "ready";

    return (
        <>
            <Stack gap="xl">
                <Stack gap="sm" className="content-sheet__intro">
                    <Text size="sm" c="dimmed">
                        {selectedChannelName === null ? t("contentSheet.mods.channelHintUnavailable") : t("contentSheet.mods.channelHint", { channel: selectedChannelName })}
                    </Text>
                    {!isRepositoryReady && (
                        <Text size="sm" c="orange">
                            {state.message ?? t("contentSheet.context.unavailable")}
                        </Text>
                    )}
                    {mainError !== null && (
                        <Text size="sm" c="red">
                            {mainError}
                        </Text>
                    )}
                </Stack>

                <ContentSection
                    title={t("contentSheet.mods.installed.title")}
                    actions={
                        <Group gap="xs" wrap="nowrap">
                            <Menu shadow="md" width={260} position="bottom-end" disabled={!isRepositoryReady || busyAction !== null}>
                                <Menu.Target>
                                    <Tooltip label={t("contentSheet.mods.add.tooltip")} position="top">
                                        <ActionIcon variant="light" radius="md" disabled={!isRepositoryReady || busyAction !== null} aria-label={t("contentSheet.mods.add.tooltip")}>
                                            +
                                        </ActionIcon>
                                    </Tooltip>
                                </Menu.Target>
                                <Menu.Dropdown>
                                    <Menu.Label>{t("contentSheet.mods.add.menuTitle")}</Menu.Label>
                                    <Menu.Item onClick={() => setIsGitModalOpen(true)}>{t("contentSheet.mods.add.fromGit")}</Menu.Item>
                                    <Menu.Item disabled>{t("contentSheet.mods.add.fromFolder")}</Menu.Item>
                                    <Menu.Item disabled>{t("contentSheet.mods.add.fromArchive")}</Menu.Item>
                                </Menu.Dropdown>
                            </Menu>
                            <Tooltip label={t("contentSheet.mods.check.button")} position="top">
                                <ActionIcon variant="subtle" radius="md" onClick={checkUpdates} disabled={!isRepositoryReady || busyAction !== null} loading={busyAction === "check" || state.checking} aria-label={t("contentSheet.mods.check.button")}>
                                    ↻
                                </ActionIcon>
                            </Tooltip>
                        </Group>
                    }
                >
                    {sortedMods.length === 0 ? (
                        <Text size="sm" c="dimmed">
                            {t("contentSheet.mods.empty")}
                        </Text>
                    ) : (
                        sortedMods.map((mod) => (
                            <ModCard key={mod.id} mod={mod} busyAction={busyAction} onUpdate={updateMod} onForceUpdate={forceUpdateMod} onRemove={removeMod} onOpenFolder={openFolder} />
                        ))
                    )}
                </ContentSection>
            </Stack>

            <Modal opened={isGitModalOpen} onClose={() => setIsGitModalOpen(false)} title={t("contentSheet.mods.gitModal.title")} centered size="lg">
                <Stack gap="md">
                    <Text size="sm" c="dimmed">
                        {t("contentSheet.mods.gitModal.description")}
                    </Text>
                    <TextInput
                        label={t("contentSheet.mods.url.label")}
                        description={t("contentSheet.mods.url.description")}
                        placeholder="https://github.com/example/cdda-example-mod.git"
                        value={gitUrl}
                        onChange={(event) => {
                            setGitUrl(event.currentTarget.value);
                            setGitError(null);
                        }}
                        disabled={!isRepositoryReady || busyAction === "install"}
                        autoFocus
                    />
                    {gitError !== null && (
                        <Alert variant="light" color="red" title={t("contentSheet.mods.install.errorTitle")}>
                            {gitError}
                        </Alert>
                    )}
                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={() => setIsGitModalOpen(false)} disabled={busyAction === "install"}>
                            {t("common.cancel")}
                        </Button>
                        <Button onClick={installGitMod} disabled={!isRepositoryReady || gitUrl.trim().length === 0 || busyAction === "install"} loading={busyAction === "install"}>
                            {t("contentSheet.mods.install.button")}
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </>
    );
}

function ModCard({ mod, busyAction, onUpdate, onForceUpdate, onRemove, onOpenFolder }: { mod: ModRepositoryItem; busyAction: string | null; onUpdate: (mod: ModRepositoryItem) => Promise<void>; onForceUpdate: (mod: ModRepositoryItem) => Promise<void>; onRemove: (mod: ModRepositoryItem) => Promise<void>; onOpenFolder: (mod: ModRepositoryItem) => Promise<void> }): React.JSX.Element {
    const { t } = useLocalization();
    const busy = busyAction === `update:${mod.id}` || busyAction === `remove:${mod.id}`;

    return (
        <Card withBorder radius="md" p="md">
            <Stack gap="xs">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={2}>
                        <Group gap="xs">
                            <Text fw={700}>{mod.displayName}</Text>
                            <Badge size="sm" color={getModStatusColor(mod)} variant="light">
                                {t(getModStatusKey(mod))}
                            </Badge>
                        </Group>
                        <Text size="xs" c="dimmed">
                            {mod.id} · {mod.provider} · {mod.defaultBranch}
                        </Text>
                    </Stack>
                </Group>

                {mod.error !== undefined && (
                    <Text size="sm" c="red">
                        {mod.error}
                    </Text>
                )}
                {mod.hasLocalChanges && (
                    <Text size="sm" c="orange">
                        {t("contentSheet.mods.localChanges")}
                    </Text>
                )}
                {mod.updateAvailable && (
                    <Text size="sm" c="blue">
                        {t("contentSheet.mods.updateAvailable")}
                    </Text>
                )}

                <Group gap="xs">
                    <Button size="xs" variant="light" onClick={() => onUpdate(mod)} disabled={busy} loading={busyAction === `update:${mod.id}`}>
                        {t("contentSheet.mods.update.button")}
                    </Button>
                    {mod.hasLocalChanges && (
                        <Button size="xs" variant="light" color="red" onClick={() => onForceUpdate(mod)} disabled={busy}>
                            {t("contentSheet.mods.update.forceButton")}
                        </Button>
                    )}
                    <Button size="xs" variant="subtle" onClick={() => onOpenFolder(mod)} disabled={busy}>
                        {t("contentSheet.selection.openFolder")}
                    </Button>
                    <Button size="xs" variant="subtle" color="red" onClick={() => onRemove(mod)} disabled={busy} loading={busyAction === `remove:${mod.id}`}>
                        {t("contentSheet.mods.remove.button")}
                    </Button>
                </Group>
            </Stack>
        </Card>
    );
}

function PlaceholderContent({ kind, selectedChannelName }: { kind: ContentSheetKind; selectedChannelName: string | null }): React.JSX.Element {
    const { t } = useLocalization();

    return (
        <Stack gap="xl">
            <ContentSection title={t("contentSheet.library.title")} description={t(contentDescriptionKeyByKind[kind])}>
                <Alert variant="light" color="blue" title={t("contentSheet.placeholder.title")}>
                    <Stack gap={4}>
                        <Text size="sm">{t("contentSheet.placeholder.description")}</Text>
                        <Text size="sm" c="dimmed">
                            {selectedChannelName === null ? t("contentSheet.context.unavailable") : t("contentSheet.context.selected", { channel: selectedChannelName })}
                        </Text>
                    </Stack>
                </Alert>
                <Button variant="light" disabled>
                    {t(contentPrimaryActionKeyByKind[kind])}
                </Button>
            </ContentSection>
        </Stack>
    );
}

const contentTitleKeyByKind: Record<ContentSheetKind, string> = {
    mods: "contentSheet.mods.title",
    soundpack: "contentSheet.soundpack.title",
    tileset: "contentSheet.tileset.title"
};

const contentDescriptionKeyByKind: Record<ContentSheetKind, string> = {
    mods: "contentSheet.mods.description",
    soundpack: "contentSheet.soundpack.description",
    tileset: "contentSheet.tileset.description"
};

const contentPrimaryActionKeyByKind: Record<ContentSheetKind, string> = {
    mods: "contentSheet.mods.primaryAction",
    soundpack: "contentSheet.soundpack.primaryAction",
    tileset: "contentSheet.tileset.primaryAction"
};

type ContentSectionProps = {
    title: string;
    description?: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
};

function ContentSection({ title, description, actions, children }: ContentSectionProps): React.JSX.Element {
    return (
        <Stack gap="sm" className="settings-section">
            <Stack gap={2}>
                <Group justify="space-between" align="center" wrap="nowrap">
                    <Title order={4}>{title}</Title>
                    {actions !== undefined && actions}
                </Group>
                {description !== undefined && description.length > 0 && (
                    <Text size="sm" c="dimmed">
                        {description}
                    </Text>
                )}
            </Stack>
            <Stack gap="xs">{children}</Stack>
            <Divider />
        </Stack>
    );
}

function compareMods(left: ModRepositoryItem, right: ModRepositoryItem): number {
    if (left.updateAvailable !== right.updateAvailable) {
        return left.updateAvailable ? -1 : 1;
    }

    const leftUpdatedAt = Date.parse(left.updatedAt);
    const rightUpdatedAt = Date.parse(right.updatedAt);
    const leftTime = Number.isNaN(leftUpdatedAt) ? 0 : leftUpdatedAt;
    const rightTime = Number.isNaN(rightUpdatedAt) ? 0 : rightUpdatedAt;

    if (leftTime !== rightTime) {
        return rightTime - leftTime;
    }

    return left.id.localeCompare(right.id);
}

function getModStatusKey(mod: ModRepositoryItem): string {
    if (mod.status === "update-available") return "contentSheet.mods.status.updateAvailable";
    if (mod.status === "blocked-by-local-changes") return "contentSheet.mods.status.blockedByLocalChanges";
    if (mod.status === "missing-local-copy") return "contentSheet.mods.status.missingLocalCopy";
    if (mod.status === "invalid-local-copy") return "contentSheet.mods.status.invalidLocalCopy";
    if (mod.status === "error") return "contentSheet.mods.status.error";
    return "contentSheet.mods.status.installed";
}

function getModStatusColor(mod: ModRepositoryItem): string {
    if (mod.status === "update-available") return "blue";
    if (mod.status === "blocked-by-local-changes") return "orange";
    if (mod.status === "missing-local-copy" || mod.status === "invalid-local-copy" || mod.status === "error") return "red";
    return "green";
}
