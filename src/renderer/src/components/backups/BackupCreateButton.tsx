import type React from "react";
import { Button, Menu, Stack, Text, Tooltip } from "@mantine/core";
import { TLocalizeFn, useTranslate } from "@renderer/stores/useLocaleStore";
import { useConfigStore } from "@renderer/stores/useConfigStore";
import { LocalizedText } from "@renderer/components/LocalizedText";
import { useGameStateStore } from "@renderer/stores/useGameStateStore";
import { useGameBackupStore } from "@renderer/stores/useGameBackupStore";
import { useGameFileOperationStore } from "@renderer/stores/useGameFileOperationStore";
import { IconDeviceFloppy } from "@tabler/icons-react";
import { defaultIconProps } from "@renderer/utils/defaultIconProps";

export function BackupCreateButton(): React.JSX.Element | null {
    const t = useTranslate();
    const backupsEnabled = useConfigStore((state) => state.backupsEnabled);
    const gameState = useGameStateStore((state) => state.state);
    const backupProgress = useGameBackupStore((state) => state.progress);
    const fileOperationRunning = useGameFileOperationStore((state) => state.isRunning);
    const createManualBackup = useGameBackupStore((state) => state.createManual);

    const activeGameBundle = gameState.status === "ready" ? gameState.gameBundle : null;
    const saveSummary = gameState.status === "ready" ? gameState.saves : null;
    const savesStable = gameState.status !== "ready" || gameState.savesStable;
    const worlds = saveSummary?.worlds ?? [];
    const currentWorld = saveSummary?.currentWorld ?? null;
    const backupableWorlds = worlds.filter((world) => world.characterName !== null);
    const backupBusy = backupProgress.status === "creating" || backupProgress.status === "restoring" || fileOperationRunning;
    const tooltip = getBackupButtonTooltip(t, backupsEnabled, !!activeGameBundle, backupableWorlds.length, savesStable, backupBusy);

    const disabled = !backupsEnabled || !activeGameBundle || backupableWorlds.length === 0 || !savesStable || backupBusy;

    const createBackup = async (worldName?: string): Promise<void> => {
        await createManualBackup(worldName === undefined ? {} : { worldName });
    };

    if (!backupsEnabled) return null;
    if (!backupableWorlds.length) return null;

    if (backupableWorlds.length == 1) {
        return (
            <Tooltip label={tooltip}>
                <Icon disabled={disabled} onClick={() => void createBackup(backupableWorlds[0]?.name)} />
            </Tooltip>
        );
    }

    return (
        <Menu shadow="md" width={320} position="top-end" disabled={disabled}>
            <Menu.Target>
                <Tooltip label={tooltip}>{<Icon disabled={disabled} />}</Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Label>{t("home.world.select.world")}</Menu.Label>
                {backupableWorlds.map((world) => (
                    <Menu.Item key={world.folderName} onClick={() => void createBackup(world.name)} rightSection={world.folderName === currentWorld?.folderName ? "✓" : undefined}>
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

function Icon({ disabled, onClick }: { disabled: boolean; onClick?: () => void }): React.JSX.Element {
    const t = useTranslate();
    const buttonName = t("backup.action.save");
    return (
        <Tooltip label={t("home.backup.create.tooltip")}>
            <Button size="md" variant="light" disabled={disabled} onClick={onClick} aria-label={buttonName} leftSection={<IconDeviceFloppy {...defaultIconProps} />}>
                {buttonName}
            </Button>
        </Tooltip>
    );
}

function getBackupButtonTooltip(t: TLocalizeFn, enabled: boolean, activeGameBundleAvailable: boolean, backupableWorldCount: number, savesStable: boolean, backupBusy: boolean): string {
    if (!enabled) return t("home.backup.disabled.tooltip");
    if (!activeGameBundleAvailable) return t("home.backup.no.install.tooltip");
    if (backupableWorldCount === 0) return t("home.backup.no.save.tooltip");
    if (!savesStable) return t("home.backup.saving.tooltip");
    if (backupBusy) return t("home.backup.busy.tooltip");
    return t("home.backup.create.tooltip");
}
