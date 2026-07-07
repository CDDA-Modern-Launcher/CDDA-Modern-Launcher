import React, { useCallback, useMemo } from "react";
import { ComboboxItem, ComboboxLikeRenderOptionInput, Select, Text } from "@mantine/core";
import { isAutoBackupCooldown } from "../../../shared/backups/isAutoBackupCooldown";
import { useConfigStore } from "@renderer/stores/useConfigStore";
import { useTranslate } from "@renderer/localization/useLocaleStore";

export function AutoBackupCooldown(): React.JSX.Element {
    const t = useTranslate();

    const autoBackupCooldown = useConfigStore((state) => state.autoBackupCooldown);
    const backupsEnabled = useConfigStore((state) => state.backupsEnabled);
    const autoBackupLimit = useConfigStore((state) => state.autoBackupLimit);

    const setAutoBackupCooldown = useConfigStore((state) => state.setAutoBackupCooldown);

    const autoBackupCooldownOptions = useMemo(
        () => [
            { value: "disabled", label: t("settings.backups.cooldown.noPause") },
            { value: "5s", label: t("settings.backups.cooldown.5s") },
            { value: "15s", label: t("settings.backups.cooldown.15s") },
            { value: "1m", label: t("settings.backups.cooldown.1m") }
        ],
        [t]
    );

    const handleChange = useCallback(
        async (value: string | null) => {
            if (isAutoBackupCooldown(value)) {
                await setAutoBackupCooldown(value);
            }
        },
        [setAutoBackupCooldown]
    );

    return (
        <Select
            label={t("settings.backups.autoCooldown")}
            description={t("settings.backups.autoCooldownDescription")}
            value={autoBackupCooldown}
            data={autoBackupCooldownOptions}
            allowDeselect={false}
            renderOption={Renderer}
            disabled={!backupsEnabled || autoBackupLimit === "disabled"}
            onChange={handleChange}
        />
    );
}

function Renderer({ option }: ComboboxLikeRenderOptionInput<ComboboxItem>): React.ReactNode {
    return <Text size="sm">{option.label}</Text>;
}
