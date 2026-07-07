import React from "react";
import { LocaleSelector } from "@renderer/localization/LocaleSelector";
import { Group, Select, Text } from "@mantine/core";
import { SheetSection } from "@renderer/components/SheetSection";
import { ThemeIcon } from "@renderer/components/ThemeIcon";
import { getThemeOptions } from "@renderer/utils/getThemeOptions";
import { isAppTheme } from "../../../shared/appearance/isAppTheme";
import { useAppearanceStore } from "@renderer/stores/useAppearanceStore";
import { useTranslate } from "@renderer/localization/useLocaleStore";

export function SettingsSheetTitle(): React.JSX.Element {
    const t = useTranslate();

    const themeSource = useAppearanceStore((state) => state.theme);
    const setThemeSource = useAppearanceStore((state) => state.setThemeSource);

    const themeOptions = getThemeOptions(t);
    const currentTheme = themeOptions.find((option) => option.value === themeSource);

    return (
        <SheetSection title={t("settings.appearance.title")}>
            <LocaleSelector />
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
        </SheetSection>
    );
}
