import { GameWorldInfo } from "../../../shared/GameWorldInfo";
import type React from "react";
import { Button, Menu, Stack, Text, Tooltip } from "@mantine/core";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { LocalizedText } from "@renderer/components/LocalizedText";

export function LastWorldButton({
    activeGameBundleAvailable,
    gameRunning,
    actionDisabled,
    worlds,
    currentWorld,
    onLaunch
}: {
    activeGameBundleAvailable: boolean;
    gameRunning: boolean;
    actionDisabled: boolean;
    worlds: GameWorldInfo[];
    currentWorld: GameWorldInfo | null;
    onLaunch: (worldName?: string) => Promise<void>;
}): React.JSX.Element {
    const t = useTranslate();
    const disabled = !activeGameBundleAvailable || gameRunning || actionDisabled || worlds.length === 0;
    const tooltip = gameRunning ? t("home.action.load.world.tooltip.running") : t("home.action.load.world.tooltip");

    if (worlds.length <= 1) {
        return (
            <Tooltip label={tooltip}>
                <Button size="md" variant="light" disabled={disabled} leftSection="▶" onClick={() => void onLaunch(worlds[0]?.name)}>
                    {t("home.action.load.world")}
                </Button>
            </Tooltip>
        );
    }

    return (
        <Menu shadow="md" width={320} position="top-end" disabled={disabled}>
            <Menu.Target>
                <Tooltip label={tooltip}>
                    <Button size="md" variant="light" disabled={disabled} leftSection="▶">
                        {t("home.action.load.world.with.choice")}
                    </Button>
                </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Label>{t("home.world.select.world")}</Menu.Label>
                {worlds.map((world) => (
                    <Menu.Item key={world.folderName} onClick={() => void onLaunch(world.name)} rightSection={world.folderName === currentWorld?.folderName ? "✓" : undefined}>
                        <Stack gap={0}>
                            <Text size="sm">{world.name}</Text>
                            <LocalizedText size="xs" c="dimmed" i18nKey="home.world.character" variables={{ character: world.characterName ?? t("home.world.unknown") }} />
                        </Stack>
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
    );
}
