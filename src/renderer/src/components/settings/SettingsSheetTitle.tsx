import React from "react";
import { LocaleSelector } from "@renderer/localization/LocaleSelector";
import { Group, Select, Text } from "@mantine/core";
import { useLocalization } from "@renderer/localization/LocalizationContext";
import { SheetSection } from "@renderer/components/settings/SheetSection";
import { ThemeIcon } from "@renderer/components/settings/ThemeIcon";
import { useSystemAppearance } from "@renderer/hooks/useSystemAppearance";
import { getThemeOptions } from "@renderer/components/settings/getThemeOptions";
import { isAppTheme } from "../../../../shared/appearance/isAppTheme";

export function SettingsSheetTitle(): React.JSX.Element {
    const { t } = useLocalization();
    const appearance = useSystemAppearance();
    const themeOptions = getThemeOptions(t);
    const currentTheme = themeOptions.find((option) => option.value === appearance.theme);

    return (
        <SheetSection title={t("settings.appearance.title")}>
            <LocaleSelector />
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
        </SheetSection>
    );
}
