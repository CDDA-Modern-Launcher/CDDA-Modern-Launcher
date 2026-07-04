import { Button, Group, Paper, Text, Tooltip } from "@mantine/core";
import React from "react";

import { useLocalization } from "../../localization/LocalizationContext";

type LauncherDockProps = {
    onOpenSettings: () => void;
    onOpenMods: () => void;
    onOpenSoundpack: () => void;
    onOpenTileset: () => void;
};

export function LauncherDock({ onOpenSettings, onOpenMods, onOpenSoundpack, onOpenTileset }: LauncherDockProps): React.JSX.Element {
    const { t } = useLocalization();

    return (
        <Paper withBorder radius="lg" shadow="xl" className="launcher-dock">
            <Group justify="space-between" gap="md" wrap="nowrap">
                <Group gap="xs" wrap="nowrap" className="launcher-dock__section">
                    <Button variant="subtle" size="xs" radius="md" disabled className="launcher-dock__button">
                        {t("dock.fork.placeholder")}
                    </Button>
                    <Text size="xs" c="dimmed" className="launcher-dock__status">
                        <span className="launcher-dock__status-dot" />
                        {t("dock.status.uiOnly")}
                    </Text>
                </Group>

                <Group gap="xs" wrap="nowrap" className="launcher-dock__section launcher-dock__section--right">
                    <Button variant="light" size="xs" radius="md" onClick={onOpenTileset} className="launcher-dock__button">
                        {t("dock.tileset")}
                    </Button>
                    <Button variant="light" size="xs" radius="md" onClick={onOpenSoundpack} className="launcher-dock__button">
                        {t("dock.soundpack")}
                    </Button>
                    <Button variant="light" size="xs" radius="md" onClick={onOpenMods} className="launcher-dock__button">
                        {t("dock.mods")}
                    </Button>

                    <Tooltip label={t("dock.settings.tooltip")} position="top">
                        <Button variant="filled" size="xs" radius="md" onClick={onOpenSettings} className="launcher-dock__settings-button">
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
