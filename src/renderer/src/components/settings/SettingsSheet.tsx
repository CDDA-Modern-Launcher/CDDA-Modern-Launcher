import { Divider, Drawer, Group, Select, Stack, Switch, Text, Title, Tooltip } from "@mantine/core";
import React from "react";

import { AppTheme } from "../../../../shared/appearance";
import type { AutoBackupCooldown, AutoBackupLimit, BackupRotationLimit } from "../../../../shared/backups";
import type { GameAssetVariant } from "../../../../shared/gameAssetVariants";
import { useLauncherSettings } from "../../hooks/useLauncherSettings";
import { useSystemAppearance } from "../../hooks/useSystemAppearance";
import { LocaleSelector } from "../../localization/LocaleSelector";
import { useLocalization } from "../../localization/LocalizationContext";

type SettingsSheetProps = {
    opened: boolean;
    onClose: () => void;
};

export function SettingsSheet({ opened, onClose }: SettingsSheetProps): React.JSX.Element {
    const { t } = useLocalization();
    const appearance = useSystemAppearance();
    const launcherSettings = useLauncherSettings();
    const themeOptions = getThemeOptions(t);
    const currentTheme = themeOptions.find((option) => option.value === appearance.theme);
    const gameAssetVariantOptions = getGameAssetVariantOptions(t);
    const autoBackupLimitOptions = getAutoBackupLimitOptions(t);
    const autoBackupCooldownOptions = getAutoBackupCooldownOptions(t);
    const manualBackupRotationOptions = getManualBackupRotationOptions(t);

    return (
        <Drawer opened={opened} onClose={onClose} position="right" size={420} title={<Title order={3}>{t("settings.title")}</Title>}>
            <Stack gap="xl">
                <SettingsSection title={t("settings.appearance.title")}>
                    <LocaleSelector variant="settings" />
                    <Select
                        label={t("settings.appearance.theme")}
                        value={appearance.theme}
                        data={themeOptions.map((option) => ({ value: option.value, label: option.label }))}
                        onChange={(value) => {
                            if (isAppTheme(value)) {
                                appearance.setTheme(value).catch((error) => console.error("Failed to set theme", error));
                            }
                        }}
                        allowDeselect={false}
                        leftSection={<ThemeIcon icon={currentTheme?.icon} />}
                        renderOption={({ option }) => {
                            const themeOption = themeOptions.find((item) => item.value === option.value);
                            return (
                                <Group gap="xs" wrap="nowrap">
                                    <ThemeIcon icon={themeOption?.icon} />
                                    <Text size="sm">{option.label}</Text>
                                </Group>
                            );
                        }}
                    />
                </SettingsSection>

                <SettingsSection title={t("settings.game.title")}>
                    <Select
                        label={t("settings.game.assetVariant")}
                        description={t("settings.game.assetVariantDescription")}
                        value={launcherSettings.gameAssetVariant}
                        data={gameAssetVariantOptions.map((option) => ({ value: option.value, label: option.label }))}
                        allowDeselect={false}
                        onChange={(value) => {
                            if (isGameAssetVariant(value)) {
                                launcherSettings.setGameAssetVariant(value).catch((error) => console.error("Failed to set game asset variant", error));
                            }
                        }}
                    />
                </SettingsSection>

                <SettingsSection
                    title={t("settings.backups.title")}
                    rightSection={
                        <Tooltip label={t("settings.backups.enabledTooltip")}>
                            <Switch
                                aria-label={t("settings.backups.enabled")}
                                checked={launcherSettings.backupsEnabled}
                                onChange={(event) => launcherSettings.setBackupsEnabled(event.currentTarget.checked).catch((error) => console.error("Failed to set backups enabled", error))}
                            />
                        </Tooltip>
                    }
                >
                    <Select
                        label={t("settings.backups.autoLimit")}
                        description={t("settings.backups.autoLimitDescription")}
                        value={launcherSettings.autoBackupLimit}
                        data={autoBackupLimitOptions.map((option) => ({ value: option.value, label: option.label }))}
                        allowDeselect={false}
                        renderOption={({ option }) => <BackupSelectOption label={option.label} tooltip={getAutoBackupLimitOptionTooltip(t, option.value)} />}
                        disabled={!launcherSettings.backupsEnabled}
                        onChange={(value) => {
                            if (isAutoBackupLimit(value)) {
                                launcherSettings.setAutoBackupLimit(value).catch((error) => console.error("Failed to set auto backup limit", error));
                            }
                        }}
                    />
                    <Select
                        label={t("settings.backups.autoCooldown")}
                        description={t("settings.backups.autoCooldownDescription")}
                        value={launcherSettings.autoBackupCooldown}
                        data={autoBackupCooldownOptions.map((option) => ({ value: option.value, label: option.label }))}
                        allowDeselect={false}
                        renderOption={({ option }) => <BackupSelectOption label={option.label} />}
                        disabled={!launcherSettings.backupsEnabled || launcherSettings.autoBackupLimit === "disabled"}
                        onChange={(value) => {
                            if (isAutoBackupCooldown(value)) {
                                launcherSettings.setAutoBackupCooldown(value).catch((error) => console.error("Failed to set auto backup cooldown", error));
                            }
                        }}
                    />
                    <Select
                        label={t("settings.backups.manualRotation")}
                        description={t("settings.backups.manualRotationDescription")}
                        value={launcherSettings.manualBackupRotationLimit}
                        data={manualBackupRotationOptions.map((option) => ({ value: option.value, label: option.label }))}
                        allowDeselect={false}
                        renderOption={({ option }) => <BackupSelectOption label={option.label} tooltip={getManualBackupRotationOptionTooltip(t, option.value)} />}
                        disabled={!launcherSettings.backupsEnabled}
                        onChange={(value) => {
                            if (isBackupRotationLimit(value)) {
                                launcherSettings.setManualBackupRotationLimit(value).catch((error) => console.error("Failed to set manual backup rotation", error));
                            }
                        }}
                    />
                </SettingsSection>
            </Stack>
        </Drawer>
    );
}

type ThemeOption = {
    value: AppTheme;
    label: string;
    icon: string;
};

type GameAssetVariantOption = {
    value: GameAssetVariant;
    label: string;
};

type BackupOption<T extends string> = {
    value: T;
    label: string;
};

function getThemeOptions(t: (key: string) => string): ThemeOption[] {
    return [
        { value: "system", label: t("settings.theme.system"), icon: "◐" },
        { value: "dark", label: t("settings.theme.dark"), icon: "☾" },
        { value: "light", label: t("settings.theme.light"), icon: "☀" }
    ];
}

function getGameAssetVariantOptions(t: (key: string) => string): GameAssetVariantOption[] {
    return [
        { value: "graphics-and-sounds", label: t("settings.game.assetVariant.graphicsAndSounds") },
        { value: "graphics", label: t("settings.game.assetVariant.graphics") },
        { value: "tiles", label: t("settings.game.assetVariant.tiles") }
    ];
}

function getAutoBackupLimitOptions(t: (key: string) => string): Array<BackupOption<AutoBackupLimit>> {
    return [
        { value: "disabled", label: t("settings.backups.limit.disabled") },
        { value: "3", label: t("settings.backups.limit.max3") },
        { value: "5", label: t("settings.backups.limit.max5") },
        { value: "10", label: t("settings.backups.limit.max10") }
    ];
}

function getAutoBackupCooldownOptions(t: (key: string) => string): Array<BackupOption<AutoBackupCooldown>> {
    return [
        { value: "disabled", label: t("settings.backups.cooldown.noPause") },
        { value: "5s", label: t("settings.backups.cooldown.5s") },
        { value: "15s", label: t("settings.backups.cooldown.15s") },
        { value: "1m", label: t("settings.backups.cooldown.1m") }
    ];
}

function getManualBackupRotationOptions(t: (key: string) => string): Array<BackupOption<BackupRotationLimit>> {
    return [
        { value: "disabled", label: t("settings.backups.rotation.all") },
        { value: "3", label: t("settings.backups.limit.max3") },
        { value: "5", label: t("settings.backups.limit.max5") },
        { value: "10", label: t("settings.backups.limit.max10") }
    ];
}

function isAppTheme(value: string | null): value is AppTheme {
    return value === "system" || value === "dark" || value === "light";
}

function isGameAssetVariant(value: string | null): value is GameAssetVariant {
    return value === "graphics-and-sounds" || value === "graphics" || value === "tiles";
}

function isAutoBackupLimit(value: string | null): value is AutoBackupLimit {
    return value === "disabled" || value === "3" || value === "5" || value === "10";
}

function isAutoBackupCooldown(value: string | null): value is AutoBackupCooldown {
    return value === "disabled" || value === "5s" || value === "15s" || value === "1m";
}

function isBackupRotationLimit(value: string | null): value is BackupRotationLimit {
    return value === "disabled" || value === "3" || value === "5" || value === "10";
}

function ThemeIcon({ icon }: { icon: string | undefined }): React.JSX.Element | null {
    if (icon === undefined) {
        return null;
    }

    return (
        <Text component="span" aria-hidden="true" className="theme-select-icon">
            {icon}
        </Text>
    );
}

type SettingsSectionProps = {
    title: string;
    children: React.ReactNode;
    rightSection?: React.ReactNode;
};

function SettingsSection({ title, children, rightSection }: SettingsSectionProps): React.JSX.Element {
    return (
        <Stack gap="sm" className="settings-section">
            <Group justify="space-between" align="center" wrap="nowrap">
                <Title order={4}>{title}</Title>
                {rightSection}
            </Group>
            <Stack gap="xs">{children}</Stack>
            <Divider />
        </Stack>
    );
}

function BackupSelectOption({ label, tooltip }: { label: string; tooltip?: string }): React.JSX.Element {
    const option = <Text size="sm">{label}</Text>;

    if (tooltip === undefined) {
        return option;
    }

    return (
        <Tooltip label={tooltip} position="right" withArrow>
            {option}
        </Tooltip>
    );
}

function getAutoBackupLimitOptionTooltip(t: (key: string) => string, value: string): string | undefined {
    return value === "disabled" ? t("settings.backups.limit.disabledTooltip") : undefined;
}

function getManualBackupRotationOptionTooltip(t: (key: string) => string, value: string): string | undefined {
    return value === "disabled" ? t("settings.backups.rotation.allTooltip") : undefined;
}
