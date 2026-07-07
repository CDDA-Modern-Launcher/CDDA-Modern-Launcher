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
            title: t("contentSheet.mods.update.forceConfirmTitle"),
            children: <Text size="sm">{t("contentSheet.mods.update.forceConfirm", { name: mod.displayName })}</Text>,
            labels: { confirm: t("common.update"), cancel: t("common.cancel") },
            confirmProps: { color: "red" },
            onConfirm: () => void update(mod, true)
        });
    };

    const removeMod = (mod: ModInstanceInfo): void => {
        modals.openConfirmModal({
            title: t("contentSheet.mods.remove.confirmTitle"),
            children: <Text size="sm">{t("contentSheet.mods.remove.confirm", { name: mod.displayName })}</Text>,
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
                        {t("contentSheet.mods.localChanges")}
                    </Text>
                )}
                {mod.updateAvailable && (
                    <Text size="sm" c="blue">
                        {t("contentSheet.mods.updateAvailable")}
                    </Text>
                )}

                <Group gap="xs">
                    <Button size="xs" variant="light" onClick={() => update(mod)} disabled={busyAction !== null} loading={busyModId === mod.id && busyAction === "update"}>
                        {t("contentSheet.mods.update.button")}
                    </Button>
                    {mod.hasLocalChanges && (
                        <Button size="xs" variant="light" color="red" onClick={() => forceUpdateMod(mod)} disabled={busyAction !== null}>
                            {/* todo: tooltip */}
                            {t("contentSheet.mods.update.forceButton")}
                        </Button>
                    )}
                    <Button size="xs" variant="subtle" onClick={() => openFolder(mod)} disabled={busyAction !== null}>
                        {t("contentSheet.selection.openFolder")}
                    </Button>
                    <Button size="xs" variant="subtle" color="red" onClick={() => removeMod(mod)} disabled={busyAction !== null} loading={busyModId === mod.id && busyAction === "remove"}>
                        {t("contentSheet.mods.remove.button")}
                    </Button>
                </Group>
            </Stack>
        </Card>
    );
}
