import { Button, Divider, Drawer, Group, Select, Stack, Switch, Text, Title } from "@mantine/core";
import React from "react";

import { AppTheme } from "../../../../shared/appearance";
import { findGameChannel, getEffectiveGameChannels } from "../../../../shared/gameChannels";
import { RepositoryStatus } from "../../../../shared/repository";
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
    const themeOptions = getThemeOptions(t);
    const currentTheme = themeOptions.find((option) => option.value === appearance.theme);
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
                    <Switch label={t("settings.backups.beforeUpdate")} disabled />
                    <Button variant="light" disabled>
                        {t("settings.backups.location")}
                    </Button>
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

function getThemeOptions(t: (key: string) => string): ThemeOption[] {
    return [
        { value: "system", label: t("settings.theme.system"), icon: "◐" },
        { value: "dark", label: t("settings.theme.dark"), icon: "☾" },
        { value: "light", label: t("settings.theme.light"), icon: "☀" }
    ];
}

function isAppTheme(value: string | null): value is AppTheme {
    return value === "system" || value === "dark" || value === "light";
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
