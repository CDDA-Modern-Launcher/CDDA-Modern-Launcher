import {WorkspaceStatus} from "../../../../shared/workspace/WorkspaceStatus";
import React, { useEffect, useMemo, useState } from "react";
import {useLocalization} from "@renderer/localization/LocalizationContext";
import {ModRepositoryState} from "../../../../shared/mods/ModRepositoryState";
import {ModRepositoryNoticeEvent} from "../../../../shared/mods/ModRepositoryNoticeEvent";
import {compareMods} from "@renderer/components/settings/content/compareMods";
import {EModInstallResult} from "../../../../shared/mods/EModInstallResult";
import {ModInstanceInfo} from "../../../../shared/mods/ModInstanceInfo";
import {EModUpdateResult} from "../../../../shared/mods/EModUpdateResult";
import {modals} from "@mantine/modals";
import {ActionIcon, Alert, Button, Group, Menu, Modal, Stack, Text, TextInput, Tooltip} from "@mantine/core";
import {ContentSection} from "@renderer/components/settings/content/ContentSection";
import {ModCard} from "@renderer/components/settings/content/ModCard";

export function ModsContent({ repository, selectedChannelName }: { repository: WorkspaceStatus; selectedChannelName: string | null }): React.JSX.Element {
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
        window.api.mods
            .getState()
            .then(setState)
            .catch((error) => console.error("Failed to load mods state", error));
    }, [repository]);

    const sortedMods = useMemo(() => [...state.mods].sort(compareMods), [state.mods]);

    const installGitMod = async (): Promise<void> => {
        setBusyAction("install");
        setGitError(null);
        setMainError(null);

        try {
            const result: EModInstallResult = await window.api.mods.installFromUrl(gitUrl);
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

    const updateMod = async (mod: ModInstanceInfo, force = false): Promise<void> => {
        setBusyAction(`update:${mod.id}`);
        setMainError(null);

        try {
            const result: EModUpdateResult = await window.api.mods.update(mod.id, { force });
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

    const forceUpdateMod = (mod: ModInstanceInfo): Promise<void> => {
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

    const removeMod = (mod: ModInstanceInfo): Promise<void> => {
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

    const removeModConfirmed = async (mod: ModInstanceInfo): Promise<void> => {
        setBusyAction(`remove:${mod.id}`);
        setMainError(null);

        try {
            const result = await window.api.mods.remove(mod.id);
            setState(result.state);

            if (result.status !== "deleted") {
                setMainError(result.message);
            }
        } catch (error) {
            setMainError(error instanceof Error ? error.message : String(error));
        } finally {
            setBusyAction(null);
        }
    };

    const openFolder = async (mod?: ModInstanceInfo): Promise<void> => {
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
                                <ActionIcon
                                    variant="subtle"
                                    radius="md"
                                    onClick={checkUpdates}
                                    disabled={!isRepositoryReady || busyAction !== null}
                                    loading={busyAction === "check" || state.checking}
                                    aria-label={t("contentSheet.mods.check.button")}
                                >
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
                        sortedMods.map((mod) => <ModCard key={mod.id} mod={mod} busyAction={busyAction} onUpdate={updateMod} onForceUpdate={forceUpdateMod} onRemove={removeMod} onOpenFolder={openFolder} />)
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
                        placeholder={t("contentSheet.mods.url.placeholder")}
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
