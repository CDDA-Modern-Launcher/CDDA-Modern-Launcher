import React, { useEffect, useMemo, useState } from "react";
import { ModRepositoryState } from "../../../shared/mods/ModRepositoryState";
import { ModRepositoryNoticeEvent } from "../../../shared/mods/ModRepositoryNoticeEvent";
import { compareMods } from "@renderer/utils/compareMods";
import { ModInstanceInfo } from "../../../shared/mods/ModInstanceInfo";
import { EModUpdateResult } from "../../../shared/mods/EModUpdateResult";
import { modals } from "@mantine/modals";
import { ActionIcon, Group, Menu, Stack, Text, Tooltip } from "@mantine/core";
import { ContentSection } from "@renderer/components/ContentSection";
import { ModCard } from "@renderer/components/ModCard";
import { useModalOpen } from "@renderer/modals/useModalStore";
import { useWorkspaceStore } from "@renderer/stores/useWorkspaceStore";
import { useTranslate } from "@renderer/localization/useLocaleStore";

export function ModsContent({ selectedChannelName }: { selectedChannelName: string | null }): React.JSX.Element {
    const t = useTranslate();
    const repository = useWorkspaceStore((state) => state.workspaceStatus);
    const [state, setState] = useState<ModRepositoryState>({ status: "unconfigured", mods: [], checking: false });
    const [mainError, setMainError] = useState<string | null>(null);
    const [busyAction, setBusyAction] = useState<string | null>(null);

    const openModal = useModalOpen();

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
                                    <Menu.Item onClick={() => openModal({ kind: "add-git-mod" })}>{t("contentSheet.mods.add.fromGit")}</Menu.Item>
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
        </>
    );
}
