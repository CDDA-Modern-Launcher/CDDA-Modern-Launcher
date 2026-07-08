import { Drawer, Group, Image, Select, Stack, Text, Title } from "@mantine/core";
import React, { ReactNode, useMemo } from "react";
import { SheetSection } from "@renderer/components/SheetSection";
import { AutoBackupLimit } from "@renderer/components/AutoBackupLimit";
import { AutoBackupCooldown } from "@renderer/components/AutoBackupCooldown";
import { ManualBackupRotation } from "@renderer/components/ManualBackupRotation";
import { BackupEnabledSwitch } from "@renderer/components/BackupEnabledSwitch";
import { ReleaseAssertVariantView } from "@renderer/components/ReleaseAssertVariantView";
import { useLocaleInfo, useSetLocale, useTranslate } from "@renderer/stores/useLocaleStore";
import { useDrawerStore, useIsDrawerOpened } from "@renderer/stores/useDrawerStore";
import { useAppearanceStore } from "@renderer/stores/useAppearanceStore";
import { getThemeOptions } from "@renderer/utils/getThemeOptions";
import { isAppTheme } from "../../../shared/appearance/isAppTheme";
import { ThemeIcon } from "@renderer/components/ThemeIcon";
import { LocaleOption } from "../../../shared/localization/types/LocaleOption";

export function SettingsDrawer(): ReactNode {
    const t = useTranslate();

    const close = useDrawerStore((state) => state.close);
    const isOpened = useIsDrawerOpened("settings");

    return (
        <Drawer opened={isOpened} onClose={close} position="right" size={420} title={<Title order={3}>{t("settings.title")}</Title>}>
            <Stack gap="xl">
                <SheetSection title={t("settings.appearance.title")}>
                    <LocaleSelector />
                    <ThemeSelector />
                </SheetSection>

                <SheetSection title={t("settings.game.title")}>
                    <ReleaseAssertVariantView />
                </SheetSection>

                <SheetSection title={t("settings.backups.title")} rightSection={<BackupEnabledSwitch />}>
                    <AutoBackupLimit />
                    <AutoBackupCooldown />
                    <ManualBackupRotation />
                </SheetSection>
            </Stack>
        </Drawer>
    );
}

function LocaleSelector(): React.JSX.Element | null {
    const { selectedLocale, effectiveLocale, options } = useLocaleInfo();
    const t = useTranslate();
    const setLocale = useSetLocale();

    const data = useMemo(() => options.map((option) => ({ value: option.locale, label: option.nativeName })), [options]);

    if (options.length === 0) {
        return null;
    }

    const currentValue = options.some((option) => option.locale === selectedLocale) ? selectedLocale : effectiveLocale;
    const currentOption = options.find((option) => option.locale === currentValue);

    return (
        <Select
            aria-label={t("locale.label")}
            label={t("locale.label")}
            data={data}
            value={currentValue}
            onChange={(value) => {
                if (value !== null) {
                    setLocale(value).catch((error) => console.error("Failed to set locale", error));
                }
            }}
            allowDeselect={false}
            size="xs"
            renderOption={({ option }) => <LocaleOptionRow option={options.find((locale) => locale.locale === option.value)} />}
            leftSection={<LocaleIcon option={currentOption} />}
        />
    );
}

function LocaleOptionRow({ option }: { option: LocaleOption | undefined }): React.JSX.Element {
    if (option === undefined) return <Text size="sm">—</Text>;
    return (
        <Group gap="xs" wrap="nowrap">
            <LocaleIcon option={option} />
            <Text size="sm">{option.nativeName}</Text>
        </Group>
    );
}

function LocaleIcon({ option }: { option: LocaleOption | undefined }): React.JSX.Element | null {
    if (option === undefined) return null;
    return <Image src={option.iconPng} alt="" w={18} h={12} radius={2} />;
}

function ThemeSelector(): ReactNode {
    const t = useTranslate();

    const themeSource = useAppearanceStore((state) => state.themeSource);
    const setThemeSource = useAppearanceStore((state) => state.setThemeSource);

    const themeOptions = getThemeOptions(t);
    const currentTheme = themeOptions.find((option) => option.value === themeSource);

    return (
        <Select
            label={t("settings.appearance.theme")}
            value={themeSource}
            data={themeOptions.map((option) => ({ value: option.value, label: option.label }))}
            onChange={(value) => {
                if (isAppTheme(value)) {
                    setThemeSource(value).catch((error) => console.error("Failed to set theme", error));
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
    );
}
