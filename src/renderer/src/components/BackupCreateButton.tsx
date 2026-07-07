import { GameWorldInfo } from "../../../shared/GameWorldInfo";
import type React from "react";
import { ActionIcon, Menu, Stack, Text, Tooltip } from "@mantine/core";
import { TLocalizeFn, useTranslate } from "@renderer/localization/useLocaleStore";

export function BackupCreateButton({
    enabled,
    activeGameBundleAvailable,
    worlds,
    currentWorld,
    savesStable,
    backupBusy,
    onCreate
}: {
    enabled: boolean;
    activeGameBundleAvailable: boolean;
    worlds: GameWorldInfo[];
    currentWorld: GameWorldInfo | null;
    savesStable: boolean;
    backupBusy: boolean;
    onCreate: (worldName?: string) => Promise<void>;
}): React.JSX.Element {
    const t = useTranslate();
    const backupableWorlds = worlds.filter((world) => world.characterName !== null);
    const disabled = !enabled || !activeGameBundleAvailable || backupableWorlds.length === 0 || !savesStable || backupBusy;
    const tooltip = getBackupButtonTooltip(t, enabled, activeGameBundleAvailable, backupableWorlds.length, savesStable, backupBusy);
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

function getBackupButtonTooltip(t: TLocalizeFn, enabled: boolean, activeGameBundleAvailable: boolean, backupableWorldCount: number, savesStable: boolean, backupBusy: boolean): string {
    if (!enabled) return t("home.backup.disabledTooltip");
    if (!activeGameBundleAvailable) return t("home.backup.noInstallTooltip");
    if (backupableWorldCount === 0) return t("home.backup.noSaveTooltip");
    if (!savesStable) return t("home.backup.savingTooltip");
    if (backupBusy) return t("home.backup.busyTooltip");
    return t("home.backup.createTooltip");
}
