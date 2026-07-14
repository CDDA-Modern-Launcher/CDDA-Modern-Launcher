import React, { useCallback, useMemo } from "react";
import { ComboboxItem, ComboboxLikeRenderOptionInput, Select, Text, Tooltip } from "@mantine/core";
import { useConfigStore } from "@renderer/stores/useConfigStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { TBackupRotationLimit } from "../../../shared/backups/types/TBackupRotationLimit";

export function ManualBackupRotation(): React.JSX.Element {
    const t = useTranslate();

    const manualBackupRotationLimit = useConfigStore((state) => state.manualBackupRotationLimit);
    const setManualBackupRotationLimit = useConfigStore((state) => state.setManualBackupRotationLimit);

    const backupsEnabled = useConfigStore((state) => state.backupsEnabled);

    const manualBackupRotationOptions = useMemo(
        (): { value: TBackupRotationLimit; label: string }[] => [
            { value: "disabled", label: t("settings.backups.rotation.all") },
            { value: "3", label: t("settings.backups.limit.max3") },
            { value: "5", label: t("settings.backups.limit.max5") },
            { value: "10", label: t("settings.backups.limit.max10") }
        ],
        [t]
    );

    const handleChange = useCallback(
        async (value: TBackupRotationLimit | null) => {
            if (value) {
                await setManualBackupRotationLimit(value);
            }
        },
        [setManualBackupRotationLimit]
    );

    return (
        <Select
            label={t("settings.backups.manual.rotation")}
            description={t("settings.backups.manual.rotation.description")}
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
            <Tooltip label={t("settings.backups.rotation.all.tooltip")} position="right" withArrow>
                <Text size="sm">{option.label}</Text>
            </Tooltip>
        );
    } else {
        return <Text size="sm">{option.label}</Text>;
    }
}
