import { ActionIcon, Button, Menu, Stack, Text, Tooltip } from "@mantine/core";
import type React from "react";

import { useLocalization } from "../../localization/LocalizationContext";
import { GameWorldInfo } from "../../../../shared/GameWorldInfo";

export function SaveStatusLine({ activeInstallAvailable, world, worldCount }: { activeInstallAvailable: boolean; world: GameWorldInfo | null; worldCount: number }): React.JSX.Element {
    const { t } = useLocalization();
    const text = getSaveStatusText(t, activeInstallAvailable, world, worldCount);
    return <Text c="dimmed">{text}</Text>;
}

function getSaveStatusText(t: ReturnType<typeof useLocalization>["t"], activeInstallAvailable: boolean, world: GameWorldInfo | null, worldCount: number): string {
    if (!activeInstallAvailable) return t("home.saveStatus.notInstalled");
    if (worldCount === 0) return t("home.saveStatus.noWorlds");
    if (world === null) return t("home.saveStatus.multipleWorlds", { count: worldCount.toString() });
    const character = world.characterName ?? t("home.world.unknown");
    return t("home.saveStatus.singleWorld", { world: world.name, character });
}

export function LastWorldButton({
    activeInstallAvailable,
    gameRunning,
    worlds,
    currentWorld,
    onLaunch
}: {
    activeInstallAvailable: boolean;
    gameRunning: boolean;
    worlds: GameWorldInfo[];
    currentWorld: GameWorldInfo | null;
    onLaunch: (worldName?: string) => Promise<void>;
}): React.JSX.Element {
    const { t } = useLocalization();
    const disabled = !activeInstallAvailable || gameRunning || worlds.length === 0;
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

export function BackupCreateButton({
    enabled,
    activeInstallAvailable,
    worlds,
    currentWorld,
    savesStable,
    backupBusy,
    onCreate
}: {
    enabled: boolean;
    activeInstallAvailable: boolean;
    worlds: GameWorldInfo[];
    currentWorld: GameWorldInfo | null;
    savesStable: boolean;
    backupBusy: boolean;
    onCreate: (worldName?: string) => Promise<void>;
}): React.JSX.Element {
    const { t } = useLocalization();
    const backupableWorlds = worlds.filter((world) => world.characterName !== null);
    const disabled = !enabled || !activeInstallAvailable || backupableWorlds.length === 0 || !savesStable || backupBusy;
    const tooltip = getBackupButtonTooltip(t, enabled, activeInstallAvailable, backupableWorlds.length, savesStable, backupBusy);
    const icon = (
        <ActionIcon size={42} variant="light" disabled={disabled} aria-label={t("home.backup.createTooltip")}>
            💾
        </ActionIcon>
    );

    if (backupableWorlds.length <= 1) {
        return (
            <Tooltip label={tooltip}>
                <ActionIcon size={42} variant="light" disabled={disabled} onClick={() => void onCreate(backupableWorlds[0]?.name)} aria-label={t("home.backup.createTooltip")}>
                    💾
                </ActionIcon>
            </Tooltip>
        );
    }

    return (
        <Menu shadow="md" width={320} position="top-end" disabled={disabled}>
            <Menu.Target>
                <Tooltip label={tooltip}>{icon}</Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Label>{t("home.world.selectWorld")}</Menu.Label>
                {backupableWorlds.map((world) => (
                    <Menu.Item key={world.folderName} onClick={() => void onCreate(world.name)} rightSection={world.folderName === currentWorld?.folderName ? "✓" : undefined}>
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

function getBackupButtonTooltip(t: ReturnType<typeof useLocalization>["t"], enabled: boolean, activeInstallAvailable: boolean, backupableWorldCount: number, savesStable: boolean, backupBusy: boolean): string {
    if (!enabled) return t("home.backup.disabledTooltip");
    if (!activeInstallAvailable) return t("home.backup.noInstallTooltip");
    if (backupableWorldCount === 0) return t("home.backup.noSaveTooltip");
    if (!savesStable) return t("home.backup.savingTooltip");
    if (backupBusy) return t("home.backup.busyTooltip");
    return t("home.backup.createTooltip");
}
