import { ModInstanceInfo } from "../../../shared/mods/ModInstanceInfo";
import { ReactNode, useCallback } from "react";
import { ActionIcon, Anchor, Badge, Card, Group, Stack, Text, Tooltip } from "@mantine/core";
import { getModStatusColor } from "@renderer/utils/getModStatusColor";
import { getModStatusKey } from "@renderer/utils/getModStatusKey";
import { LocalizedText } from "@renderer/components/LocalizedText";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useModsStore } from "@renderer/stores/useModsStore";
import { modals } from "@mantine/modals";
import { useShallow } from "zustand/react/shallow";
import { IconFolder, IconRefresh, IconRefreshAlert, IconX } from "@tabler/icons-react";
import { openUrl } from "@renderer/utils/openUrl";

interface Props {
    mod: ModInstanceInfo;
}

export function ModCard({ mod }: Props): ReactNode {
    const t = useTranslate();

    const { update, remove, openFolder, busyAction, busyModId } = useModsStore(
        useShallow((state) => ({
            update: state.update,
            remove: state.remove,
            openFolder: state.openFolder,
            busyAction: state.busyAction,
            busyModId: state.busyModId
        }))
    );

    const forceUpdateMod = useCallback((): void => {
        modals.openConfirmModal({
            title: t("content.sheet.mods.update.force.confirm.title"),
            children: <LocalizedText size="sm" i18nKey="content.sheet.mods.update.force.confirm" variables={{ name: mod.displayName }} />,
            labels: { confirm: t("common.update"), cancel: t("common.cancel") },
            confirmProps: { color: "red" },
            onConfirm: () => void update(mod, true)
        });
    }, [mod, t, update]);

    const removeMod = useCallback((): void => {
        modals.openConfirmModal({
            title: t("content.sheet.mods.remove.confirm.title"),
            children: <LocalizedText size="sm" i18nKey="content.sheet.mods.remove.confirm" variables={{ name: mod.displayName }} />,
            labels: { confirm: t("common.delete"), cancel: t("common.cancel") },
            confirmProps: { color: "red" },
            onConfirm: () => void remove(mod)
        });
    }, [mod, remove, t]);

    const btnSize = 26;
    const btnIconProps = { size: 20, stroke: 1.5 };

    return (
        <Card withBorder radius="md" p="md">
            <Stack gap="xs">
                <Stack gap={2}>
                    <Group wrap="nowrap" justify="space-between">
                        <Group gap="xs">
                            <Tooltip
                                label={
                                    <Text size="xs" c="dimmed">
                                        Mod ID: {mod.id}
                                        <br />
                                        Git URL: {mod.sourceUrl}
                                        <br />
                                        Origin branch: {mod.defaultBranch}
                                    </Text>
                                }
                            >
                                <Anchor fw={700} onClick={() => openUrl(mod.sourceUrl)}>
                                    {mod.displayName}
                                </Anchor>
                            </Tooltip>

                            <Badge size="sm" color={getModStatusColor(mod)} variant="light">
                                {t(getModStatusKey(mod))}
                            </Badge>
                        </Group>

                        <Group gap={4} wrap="nowrap">
                            {mod.hasLocalChanges ? (
                                <Tooltip label={t("content.sheet.mods.update.force.button")}>
                                    <ActionIcon size={btnSize} color="red" onClick={forceUpdateMod} disabled={busyAction !== null}>
                                        <IconRefreshAlert {...btnIconProps} />
                                    </ActionIcon>
                                </Tooltip>
                            ) : (
                                <Tooltip label={t("content.sheet.mods.update.button")}>
                                    <ActionIcon size={btnSize} onClick={() => update(mod)} disabled={busyAction !== null} loading={busyModId === mod.id && busyAction === "update"}>
                                        <IconRefresh {...btnIconProps} />
                                    </ActionIcon>
                                </Tooltip>
                            )}

                            <Tooltip label={t("content.sheet.selection.open.folder")}>
                                <ActionIcon size={btnSize} variant="subtle" onClick={() => openFolder(mod)} disabled={busyAction !== null}>
                                    <IconFolder {...btnIconProps} />
                                </ActionIcon>
                            </Tooltip>

                            <Tooltip label={t("content.sheet.mods.remove.button")}>
                                <ActionIcon size={btnSize} color="red" variant="subtle" onClick={removeMod} disabled={busyAction !== null} loading={busyModId === mod.id && busyAction === "remove"}>
                                    <IconX {...btnIconProps} />
                                </ActionIcon>
                            </Tooltip>
                        </Group>
                    </Group>
                </Stack>

                {mod.error !== undefined && (
                    <Text size="sm" c="red">
                        {mod.error}
                    </Text>
                )}

                {mod.hasLocalChanges && <LocalizedText size="sm" c="orange" i18nKey="content.sheet.mods.local.changes" />}

                {mod.updateAvailable && <LocalizedText size="sm" c="blue" i18nKey="content.sheet.mods.update.available" />}
            </Stack>
        </Card>
    );
}
