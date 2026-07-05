import { Button, Divider, Drawer, Group, Select, Stack, Switch, Text, Title } from "@mantine/core";
import React from "react";

import { AppTheme } from "../../../../shared/appearance";
import type { AutoBackupCooldown, AutoBackupLimit, BackupRotationLimit } from "../../../../shared/backups";
import type { GameAssetVariant } from "../../../../shared/gameAssetVariants";
import { findGameChannel, getEffectiveGameChannels } from "../../../../shared/gameChannels";
import { RepositoryStatus } from "../../../../shared/repository";
import { useLauncherSettings } from "../../hooks/useLauncherSettings";
import { useSystemAppearance } from "../../hooks/useSystemAppearance";
import { LocaleSelector } from "../../localization/LocaleSelector";
import { useLocalization } from "../../localization/LocalizationContext";

type SettingsSheetProps = {
    repository: RepositoryStatus;
    opened: boolean;
    onClose: () => void;
    onSelectChannel: (channelId: string) => Promise<void>;
};

export function SettingsSheet({ repository, opened, onClose, onSelectChannel }: SettingsSheetProps): React.JSX.Element {
    const { t } = useLocalization();
    const appearance = useSystemAppearance();
    const launcherSettings = useLauncherSettings();
    const themeOptions = getThemeOptions(t);
    const currentTheme = themeOptions.find((option) => option.value === appearance.theme);
    const gameAssetVariantOptions = getGameAssetVariantOptions(t);
    const autoBackupLimitOptions = getAutoBackupLimitOptions(t);
    const autoBackupCooldownOptions = getAutoBackupCooldownOptions(t);
    const manualBackupRotationOptions = getManualBackupRotationOptions(t);
    const channels = repository.status === "ready" ? getEffectiveGameChannels(repository.config.customChannels) : [];
    const selectedChannel = repository.status === "ready" ? findGameChannel(channels, repository.config.selectedChannelId) : null;

    return (
        <Drawer opened={opened} onClose={onClose} position="right" size={420} title={<Title order={3}>{t("settings.title")}</Title>}>
            <Stack gap="xl">
                <SettingsSection title={t("settings.appearance.title")} description={t("settings.appearance.description")}>
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

                <SettingsSection title={t("settings.game.title")} description={t("settings.game.description")}>
                    <Select
                        label={t("settings.game.channel")}
                        value={selectedChannel?.id ?? null}
                        data={channels.map((channel) => ({ value: channel.id, label: `${channel.gameName} · ${channel.channelName}` }))}
                        disabled={repository.status !== "ready"}
                        placeholder={t("settings.game.channelUnavailable")}
                        allowDeselect={false}
                        onChange={(value) => {
                            if (value !== null) {
                                onSelectChannel(value).catch((error) => console.error("Failed to select game channel", error));
                            }
                        }}
                    />
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
                    <Button variant="light" disabled>
                        {t("settings.game.addCustomChannel")}
                    </Button>
                    <Button variant="light" disabled>
                        {t("settings.game.repository")}
                    </Button>
                </SettingsSection>

                <SettingsSection title={t("settings.content.title")} description={t("settings.content.description")}>
                    <Button variant="light" disabled>
                        {t("settings.content.mods")}
                    </Button>
                    <Button variant="light" disabled>
                        {t("settings.content.soundpacks")}
                    </Button>
                    <Button variant="light" disabled>
                        {t("settings.content.tilesets")}
                    </Button>
                    <Button variant="light" disabled>
                        {t("settings.content.modpackProfile")}
                    </Button>
                </SettingsSection>

                <SettingsSection title={t("settings.backups.title")} description={t("settings.backups.description")}>
                    <Switch
                        label={t("settings.backups.enabled")}
                        checked={launcherSettings.backupsEnabled}
                        onChange={(event) => launcherSettings.setBackupsEnabled(event.currentTarget.checked).catch((error) => console.error("Failed to set backups enabled", error))}
                    />
                    <Select
                        label={t("settings.backups.autoLimit")}
                        description={t("settings.backups.autoLimitDescription")}
                        value={launcherSettings.autoBackupLimit}
                        data={autoBackupLimitOptions.map((option) => ({ value: option.value, label: option.label }))}
                        allowDeselect={false}
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
                        disabled={!launcherSettings.backupsEnabled}
                        onChange={(value) => {
                            if (isBackupRotationLimit(value)) {
                                launcherSettings.setManualBackupRotationLimit(value).catch((error) => console.error("Failed to set manual backup rotation", error));
                            }
                        }}
                    />
                    <Text size="xs" c="dimmed">
                        {t("settings.backups.rotationNote")}
                    </Text>
                </SettingsSection>

                <SettingsSection title={t("settings.advanced.title")} description={t("settings.advanced.description")}>
                    <Button variant="subtle" disabled>
                        {t("settings.advanced.openRepo")}
                    </Button>
                    <Button variant="subtle" disabled>
                        {t("settings.advanced.openLogs")}
                    </Button>
                    <Button variant="subtle" disabled>
                        {t("settings.advanced.validateLocales")}
                    </Button>
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
        { value: "disabled", label: t("settings.backups.limit.never") },
        { value: "3", label: t("settings.backups.limit.max3") },
        { value: "5", label: t("settings.backups.limit.max5") },
        { value: "10", label: t("settings.backups.limit.max10") }
    ];
}

function getAutoBackupCooldownOptions(t: (key: string) => string): Array<BackupOption<AutoBackupCooldown>> {
    return [
        { value: "disabled", label: t("settings.backups.cooldown.disabled") },
        { value: "5s", label: t("settings.backups.cooldown.5s") },
        { value: "15s", label: t("settings.backups.cooldown.15s") },
        { value: "1m", label: t("settings.backups.cooldown.1m") }
    ];
}

function getManualBackupRotationOptions(t: (key: string) => string): Array<BackupOption<BackupRotationLimit>> {
    return [
        { value: "disabled", label: t("settings.backups.rotation.disabled") },
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
    description: string;
    children: React.ReactNode;
};

function SettingsSection({ title, description, children }: SettingsSectionProps): React.JSX.Element {
    return (
        <Stack gap="sm" className="settings-section">
            <Stack gap={2}>
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Title order={4}>{title}</Title>
                </Group>
                <Text size="sm" c="dimmed">
                    {description}
                </Text>
            </Stack>
            <Stack gap="xs">{children}</Stack>
            <Divider />
        </Stack>
    );
}
