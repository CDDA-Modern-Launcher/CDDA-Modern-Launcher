import { ModInstanceInfo } from "../../../shared/mods/ModInstanceInfo";
import type React from "react";
import { useLocalization } from "@renderer/localization/LocalizationContext";
import { Badge, Button, Card, Group, Stack, Text } from "@mantine/core";
import { getModStatusColor } from "@renderer/utils/getModStatusColor";
import { getModStatusKey } from "@renderer/utils/getModStatusKey";

export function ModCard({
    mod,
    busyAction,
    onUpdate,
    onForceUpdate,
    onRemove,
    onOpenFolder
}: {
    mod: ModInstanceInfo;
    busyAction: string | null;
    onUpdate: (mod: ModInstanceInfo) => Promise<void>;
    onForceUpdate: (mod: ModInstanceInfo) => Promise<void>;
    onRemove: (mod: ModInstanceInfo) => Promise<void>;
    onOpenFolder: (mod: ModInstanceInfo) => Promise<void>;
}): React.JSX.Element {
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
