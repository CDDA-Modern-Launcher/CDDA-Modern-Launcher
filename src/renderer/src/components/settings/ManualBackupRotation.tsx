import React, { useCallback, useMemo } from "react";
import { ComboboxItem, ComboboxLikeRenderOptionInput, Select, Text, Tooltip } from "@mantine/core";
import { useLocalization } from "@renderer/localization/LocalizationContext";
import { LauncherSettingsState } from "@renderer/hooks/useSettingsIPC";
import { isBackupRotationLimit } from "../../../../shared/backups/isBackupRotationLimit";

export function ManualBackupRotation({ settings }: { settings: LauncherSettingsState }): React.JSX.Element {
    const { t } = useLocalization();
    const manualBackupRotationOptions = useMemo(
        () => [
            { value: "disabled", label: t("settings.backups.rotation.all") },
            { value: "3", label: t("settings.backups.limit.max3") },
            { value: "5", label: t("settings.backups.limit.max5") },
            { value: "10", label: t("settings.backups.limit.max10") }
        ],
        [t]
    );

    const handleChange = useCallback(
        async (value: string | null) => {
            if (isBackupRotationLimit(value)) {
                try {
                    return await settings.setManualBackupRotationLimit(value);
                } catch (error) {
                    console.error("Failed to set manual backup rotation", error);
                }
            }
        },
        [settings]
    );

    return (
        <Select
            label={t("settings.backups.manualRotation")}
            description={t("settings.backups.manualRotationDescription")}
            value={settings.manualBackupRotationLimit}
            data={manualBackupRotationOptions}
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
            <Tooltip label={t("settings.backups.rotation.allTooltip")} position="right" withArrow>
                <Text size="sm">{option.label}</Text>
            </Tooltip>
        );
    } else {
        return <Text size="sm">{option.label}</Text>;
    }
}
