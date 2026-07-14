import React, { useCallback, useMemo } from "react";
import { ComboboxItem, ComboboxLikeRenderOptionInput, Select, Text, Tooltip } from "@mantine/core";
import { useConfigStore } from "@renderer/stores/useConfigStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { TAutoBackupLimit } from "../../../shared/backups/types/TAutoBackupLimit";

export function AutoBackupLimit(): React.JSX.Element {
    const t = useTranslate();

    const autoBackupLimit = useConfigStore((state) => state.autoBackupLimit);
    const backupsEnabled = useConfigStore((state) => state.backupsEnabled);

    const setAutoBackupLimit = useConfigStore((state) => state.setAutoBackupLimit);

    const autoBackupLimitOptions = useMemo(
        (): { value: TAutoBackupLimit; label: string }[] => [
            { value: "disabled", label: t("settings.backups.limit.disabled") },
            { value: "3", label: t("settings.backups.limit.max3") },
            { value: "5", label: t("settings.backups.limit.max5") },
            { value: "10", label: t("settings.backups.limit.max10") }
        ],
        [t]
    );

    const handleChange = useCallback(
        async (value: TAutoBackupLimit | null) => {
            if (value) {
                await setAutoBackupLimit(value);
            }
        },
        [setAutoBackupLimit]
    );

    return (
        <Select
            label={t("settings.backups.auto.limit")}
            description={t("settings.backups.auto.limit.description")}
            value={autoBackupLimit}
            data={autoBackupLimitOptions}
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
            <Tooltip label={t("settings.backups.limit.disabled.tooltip")} position="right" withArrow>
                <Text size="sm">{option.label}</Text>
            </Tooltip>
        );
    } else {
        return <Text size="sm">{option.label}</Text>;
    }
}
