import { Button, Group, Paper, Tooltip } from "@mantine/core";
import { ReactNode } from "react";
import { ModRepositoryState } from "../../../shared/mods/ModRepositoryState";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useOpenDrawerSimple } from "@renderer/stores/useDrawerStore";
import { useConfigStore } from "@renderer/stores/useConfigStore";
import { SelectGameVariant } from "@renderer/components/SelectGameVariant";
import { useModsStore } from "@renderer/stores/useModsStore";

export function AppBottomDock(): ReactNode {
    const t = useTranslate();
    const modRepositoryState = useModsStore((state) => state.state);
    const modIndicatorState = getModIndicatorState(modRepositoryState);
    const openDrawer = useOpenDrawerSimple();
    const backupsEnabled = useConfigStore((state) => state.backupsEnabled);

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

                    <Button variant="light" size="xs" radius="md" onClick={() => openDrawer("mods")} className="launcher-dock__button launcher-dock__mods-button">
                        {t("dock.mods")}
                        {modIndicatorState !== "idle" && <span className={`launcher-dock__mods-indicator launcher-dock__mods-indicator--${modIndicatorState}`} aria-hidden="true" />}
                    </Button>

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

function getModIndicatorState(state: ModRepositoryState): "idle" | "checking" | "updates" {
    if (state.status !== "ready") return "idle";
    if (state.mods.some((mod) => mod.updateAvailable)) return "updates";
    if (state.checking) return "checking";
    return "idle";
}
