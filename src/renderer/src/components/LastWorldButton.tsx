import { GameWorldInfo } from "../../../shared/GameWorldInfo";
import type React from "react";
import { Button, Menu, Stack, Text, Tooltip } from "@mantine/core";
import { useTranslate } from "@renderer/localization/useLocaleStore";

export function LastWorldButton({
    activeGameBundleAvailable,
    gameRunning,
    worlds,
    currentWorld,
    onLaunch
}: {
    activeGameBundleAvailable: boolean;
    gameRunning: boolean;
    worlds: GameWorldInfo[];
    currentWorld: GameWorldInfo | null;
    onLaunch: (worldName?: string) => Promise<void>;
}): React.JSX.Element {
    const t = useTranslate();
    const disabled = !activeGameBundleAvailable || gameRunning || worlds.length === 0;
    const tooltip = gameRunning ? t("home.action.loadWorldTooltipRunning") : t("home.action.loadWorldTooltip");

    if (worlds.length <= 1) {
        return (
            <Tooltip label={tooltip}>
                <Button size="md" variant="light" disabled={disabled} leftSection="▶" onClick={() => void onLaunch(worlds[0]?.name)}>
                    {t("home.action.loadWorld")}
                </Button>
            </Tooltip>
        );
    }

    return (
        <Menu shadow="md" width={320} position="top-end" disabled={disabled}>
            <Menu.Target>
                <Tooltip label={tooltip}>
                    <Button size="md" variant="light" disabled={disabled} leftSection="▶">
                        {t("home.action.loadWorldWithChoice")}
                    </Button>
                </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Label>{t("home.world.selectWorld")}</Menu.Label>
                {worlds.map((world) => (
                    <Menu.Item key={world.folderName} onClick={() => void onLaunch(world.name)} rightSection={world.folderName === currentWorld?.folderName ? "✓" : undefined}>
                        <Stack gap={0}>
                            <Text size="sm">{world.name}</Text>
                            <Text size="xs" c="dimmed">
                                {t("home.world.character", { character: world.characterName ?? t("home.world.unknown") })}
                            </Text>
                        </Stack>
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
    );
}
