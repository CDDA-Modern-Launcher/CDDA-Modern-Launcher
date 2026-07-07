import React, { useCallback, useMemo } from "react";
import { ComboboxItem, ComboboxLikeRenderOptionInput, Select, Text, Tooltip } from "@mantine/core";
import { isBackupRotationLimit } from "../../../shared/backups/isBackupRotationLimit";
import { useConfigStore } from "@renderer/stores/useConfigStore";
import { useTranslate } from "@renderer/localization/useLocaleStore";

export function ManualBackupRotation(): React.JSX.Element {
    const t = useTranslate();

    const manualBackupRotationLimit = useConfigStore((state) => state.manualBackupRotationLimit);
    const setManualBackupRotationLimit = useConfigStore((state) => state.setManualBackupRotationLimit);

    const backupsEnabled = useConfigStore((state) => state.backupsEnabled);

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
                await setManualBackupRotationLimit(value);
            }
        },
        [setManualBackupRotationLimit]
    );

    return (
        <Select
            label={t("settings.backups.manualRotation")}
            description={t("settings.backups.manualRotationDescription")}
            value={manualBackupRotationLimit}
            data={manualBackupRotationOptions}
            allowDeselect={false}
            renderOption={Renderer}
            disabled={!backupsEnabled}
            onChange={handleChange}
        />
    );
}

function Renderer({ option }: ComboboxLikeRenderOptionInput<ComboboxItem>): React.ReactNode {
    const t = useTranslate();

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
