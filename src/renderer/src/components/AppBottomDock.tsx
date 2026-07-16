import { Button, Group, Paper, Tooltip } from "@mantine/core";
import { ReactNode } from "react";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useOpenDrawerFn } from "@renderer/stores/useDrawerStore";
import { useConfigStore } from "@renderer/stores/useConfigStore";
import { SelectGameVariant } from "@renderer/components/SelectGameVariant";
import { ModsDockButton } from "@renderer/components/mods/ModsDockButton";
import { useWorkspaceStore } from "@renderer/stores/useWorkspaceStore";

export function AppBottomDock(): ReactNode {
    const t = useTranslate();
    const openDrawer = useOpenDrawerFn();
    const backupsEnabled = useConfigStore((state) => state.backupsEnabled);
    const ws = useWorkspaceStore((state) => state.workspaceStatus);

    if (ws.status !== "ready") return null;

    return (
        <Paper withBorder radius="lg" shadow="xl" className="launcher-dock">
            <Group justify="space-between" gap="md" wrap="nowrap">
                <Group gap="xs" wrap="nowrap" className="launcher-dock__section">
                    <SelectGameVariant />

                    <Button size="xs" variant="light" onClick={() => openDrawer("game-bundles")}>
                        {t("versions.title")}
                    </Button>
                </Group>

                <Group gap="xs" wrap="nowrap" className="launcher-dock__section launcher-dock__section--right">
                    {backupsEnabled && (
                        <Button size="xs" variant="light" onClick={() => openDrawer("backups")}>
                            {t("backup.action.manage")}
                        </Button>
                    )}

                    <ModsDockButton />

                    <Tooltip label={t("dock.settings.tooltip")} position="top">
                        <Button variant="filled" size="xs" radius="md" onClick={() => openDrawer("settings")} className="launcher-dock__settings-button">
                            <span className="launcher-dock__settings-icon" aria-hidden="true">
                                ⚙
                            </span>
                            {t("dock.settings")}
                        </Button>
                    </Tooltip>
                </Group>
            </Group>
        </Paper>
    );
}
