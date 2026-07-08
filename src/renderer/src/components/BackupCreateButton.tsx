import { GameWorldInfo } from "../../../shared/GameWorldInfo";
import type React from "react";
import { ActionIcon, Menu, Stack, Text, Tooltip } from "@mantine/core";
import { TLocalizeFn, useTranslate } from "@renderer/stores/useLocaleStore";
import { useConfigStore } from "@renderer/stores/useConfigStore";
import { LocalizedText } from "@renderer/components/LocalizedText";

interface Props {
    activeGameBundleAvailable: boolean;
    worlds: GameWorldInfo[];
    currentWorld: GameWorldInfo | null;
    savesStable: boolean;
    backupBusy: boolean;
    onCreate: (worldName?: string) => Promise<void>;
}

export function BackupCreateButton({ activeGameBundleAvailable, worlds, currentWorld, savesStable, backupBusy, onCreate }: Props): React.JSX.Element | null {
    const t = useTranslate();
    const backupsEnabled = useConfigStore((state) => state.backupsEnabled);
    const backupableWorlds = worlds.filter((world) => world.characterName !== null);
    const disabled = !backupsEnabled || !activeGameBundleAvailable || backupableWorlds.length === 0 || !savesStable || backupBusy;
    const tooltip = getBackupButtonTooltip(t, backupsEnabled, activeGameBundleAvailable, backupableWorlds.length, savesStable, backupBusy);

    if (!backupableWorlds.length) {
        return null;
    }

    if (backupableWorlds.length == 1) {
        return (
            <Tooltip label={tooltip}>
                <Icon disabled={disabled} onClick={() => void onCreate(backupableWorlds[0]?.name)} />
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
                    <Menu.Item key={world.folderName} onClick={() => void onCreate(world.name)} rightSection={world.folderName === currentWorld?.folderName ? "✓" : undefined}>
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
    return (
        <ActionIcon size={42} variant="light" disabled={disabled} onClick={onClick} aria-label={t("home.backup.create.tooltip")}>
            💾
        </ActionIcon>
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
