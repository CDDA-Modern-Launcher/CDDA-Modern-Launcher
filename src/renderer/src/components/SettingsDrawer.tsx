import { Button, Drawer, Group, Image, Select, Stack, Text } from "@mantine/core";
import React, { ReactNode, useMemo, useState } from "react";
import { SheetSection } from "@renderer/components/SheetSection";
import { AutoBackupLimit } from "@renderer/components/AutoBackupLimit";
import { AutoBackupCooldown } from "@renderer/components/AutoBackupCooldown";
import { ManualBackupRotation } from "@renderer/components/ManualBackupRotation";
import { BackupEnabledSwitch } from "@renderer/components/BackupEnabledSwitch";
import { ReleaseAssertVariantView } from "@renderer/components/ReleaseAssertVariantView";
import { useLocaleInfo, useSetLocale, useTranslate } from "@renderer/stores/useLocaleStore";
import { useCloseDrawer, useIsDrawerOpened } from "@renderer/stores/useDrawerStore";
import { useAppearanceStore } from "@renderer/stores/useAppearanceStore";
import { getThemeOptions } from "@renderer/utils/getThemeOptions";
import { ThemeIcon } from "@renderer/components/ThemeIcon";
import { LocaleOption } from "../../../shared/localization/types/LocaleOption";
import { useWorkspaceStore } from "@renderer/stores/useWorkspaceStore";
import { IconFolderSymlink } from "@tabler/icons-react";

export function SettingsDrawer(): ReactNode {
    const t = useTranslate();

    const close = useCloseDrawer();
    const isOpened = useIsDrawerOpened("settings");

    return (
        <Drawer
            opened={isOpened}
            onClose={close}
            position="right"
            size={420}
            title={
                <Text fw={700} size="lg">
                    {t("settings.title")}
                </Text>
            }
        >
            <Stack gap="xl">
                <SheetSection title={t("settings.appearance.title")}>
                    <LocaleSelector />
                    <ThemeSelector />
                </SheetSection>

                <WorkspaceSettings />

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
    const { locale, options } = useLocaleInfo();
    const t = useTranslate();
    const setLocale = useSetLocale();

    const data = useMemo(() => options.map((option) => ({ value: option.locale, label: option.nativeName })), [options]);

    if (options.length === 0) {
        return null;
    }

    const currentOption = options.find((option) => option.locale === locale);

    return (
        <Select
            aria-label={t("locale.label")}
            label={t("locale.label")}
            data={data}
            value={locale}
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
            <Text size="sm" c={option.isSystem ? "blue" : undefined}>
                {option.nativeName}
            </Text>
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
                if (value) {
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

function WorkspaceSettings(): ReactNode {
    const t = useTranslate();
    const close = useCloseDrawer();
    const workspaceStatus = useWorkspaceStore((state) => state.workspaceStatus);
    const clearWorkspace = useWorkspaceStore((state) => state.clearWorkspace);
    const [isChanging, setIsChanging] = useState(false);

    if (workspaceStatus.status !== "ready") return null;

    const changeWorkspace = async (): Promise<void> => {
        setIsChanging(true);
        try {
            await clearWorkspace();
            close();
        } catch (error) {
            console.error("Failed to clear workspace", error);
            setIsChanging(false);
        }
    };

    return (
        <SheetSection title={t("settings.workspace.title")}>
            <Text size="xs" c="dimmed" lineClamp={2} title={workspaceStatus.path}>
                {workspaceStatus.path}
            </Text>
            <Button variant="light" leftSection={<IconFolderSymlink size={16} />} loading={isChanging} onClick={() => void changeWorkspace()}>
                {t("settings.workspace.change")}
            </Button>
        </SheetSection>
    );
}
