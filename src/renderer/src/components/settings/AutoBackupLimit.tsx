import React, { useCallback, useMemo } from "react";
import { isAutoBackupLimit } from "../../../../shared/backups/isAutoBackupLimit";
import { ComboboxItem, ComboboxLikeRenderOptionInput, Select, Text, Tooltip } from "@mantine/core";
import { useLocalization } from "@renderer/localization/LocalizationContext";
import { LauncherSettingsState } from "@renderer/hooks/useSettingsIPC";

export function AutoBackupLimit({ settings }: { settings: LauncherSettingsState }): React.JSX.Element {
    const { t } = useLocalization();

    const autoBackupLimitOptions = useMemo(
        () => [
            { value: "disabled", label: t("settings.backups.limit.disabled") },
            { value: "3", label: t("settings.backups.limit.max3") },
            { value: "5", label: t("settings.backups.limit.max5") },
            { value: "10", label: t("settings.backups.limit.max10") }
        ],
        [t]
    );

    const handleChange = useCallback(
        async (value: string | null) => {
            if (isAutoBackupLimit(value)) {
                try {
                    return await settings.setAutoBackupLimit(value);
                } catch (error) {
                    console.error("Failed to set auto backup limit", error);
                }
            }
        },
        [settings]
    );

    return (
        <Select
            label={t("settings.backups.autoLimit")}
            description={t("settings.backups.autoLimitDescription")}
            value={settings.autoBackupLimit}
            data={autoBackupLimitOptions}
            allowDeselect={false}
            renderOption={Renderer}
            disabled={!settings.backupsEnabled}
            onChange={handleChange}
        />
    );
}

function Renderer({ option }: ComboboxLikeRenderOptionInput<ComboboxItem>): React.ReactNode {
    const { t } = useLocalization();

    if (option.value === "disabled") {
        return (
            <Tooltip label={t("settings.backups.limit.disabledTooltip")} position="right" withArrow>
                <Text size="sm">{option.label}</Text>
            </Tooltip>
        );
    } else {
        return <Text size="sm">{option.label}</Text>;
    }
}
