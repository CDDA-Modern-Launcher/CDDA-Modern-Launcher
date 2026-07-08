import { ModInstanceInfo } from "../../../shared/mods/ModInstanceInfo";
import { ReactNode } from "react";
import { Badge, Button, Card, Group, Stack, Text } from "@mantine/core";
import { getModStatusColor } from "@renderer/utils/getModStatusColor";
import { getModStatusKey } from "@renderer/utils/getModStatusKey";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useModsStore } from "@renderer/stores/useModsStore";
import { modals } from "@mantine/modals";
import { useShallow } from "zustand/react/shallow";

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

    const forceUpdateMod = (mod: ModInstanceInfo): void => {
        modals.openConfirmModal({
            title: t("content.sheet.mods.update.force.confirm.title"),
            children: <Text size="sm">{t("content.sheet.mods.update.force.confirm", { name: mod.displayName })}</Text>,
            labels: { confirm: t("common.update"), cancel: t("common.cancel") },
            confirmProps: { color: "red" },
            onConfirm: () => void update(mod, true)
        });
    };

    const removeMod = (mod: ModInstanceInfo): void => {
        modals.openConfirmModal({
            title: t("content.sheet.mods.remove.confirm.title"),
            children: <Text size="sm">{t("content.sheet.mods.remove.confirm", { name: mod.displayName })}</Text>,
            labels: { confirm: t("common.delete"), cancel: t("common.cancel") },
            confirmProps: { color: "red" },
            onConfirm: () => void remove(mod)
        });
    };

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
                            {mod.id} · {mod.sourceUrl} · {mod.defaultBranch}
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
                        {t("content.sheet.mods.local.changes")}
                    </Text>
                )}
                {mod.updateAvailable && (
                    <Text size="sm" c="blue">
                        {t("content.sheet.mods.update.available")}
                    </Text>
                )}

                <Group gap="xs">
                    <Button size="xs" variant="light" onClick={() => update(mod)} disabled={busyAction !== null} loading={busyModId === mod.id && busyAction === "update"}>
                        {t("content.sheet.mods.update.button")}
                    </Button>
                    {mod.hasLocalChanges && (
                        <Button size="xs" variant="light" color="red" onClick={() => forceUpdateMod(mod)} disabled={busyAction !== null}>
                            {/* todo: tooltip */}
                            {t("content.sheet.mods.update.force.button")}
                        </Button>
                    )}
                    <Button size="xs" variant="subtle" onClick={() => openFolder(mod)} disabled={busyAction !== null}>
                        {t("content.sheet.selection.open.folder")}
                    </Button>
                    <Button size="xs" variant="subtle" color="red" onClick={() => removeMod(mod)} disabled={busyAction !== null} loading={busyModId === mod.id && busyAction === "remove"}>
                        {t("content.sheet.mods.remove.button")}
                    </Button>
                </Group>
            </Stack>
        </Card>
    );
}
