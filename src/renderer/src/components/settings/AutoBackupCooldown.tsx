import React, { useCallback, useMemo } from "react";
import { ComboboxItem, ComboboxLikeRenderOptionInput, Select, Text } from "@mantine/core";
import { useLocalization } from "@renderer/localization/LocalizationContext";
import { LauncherSettingsState } from "@renderer/hooks/useSettingsIPC";
import { isAutoBackupCooldown } from "../../../../shared/backups/isAutoBackupCooldown";

export function AutoBackupCooldown({ settings }: { settings: LauncherSettingsState }): React.JSX.Element {
    const { t } = useLocalization();
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
                try {
                    return await settings.setAutoBackupCooldown(value);
                } catch (error) {
                    console.error("Failed to set auto backup cooldown", error);
                }
            }
        },
        [settings]
    );

    return (
        <Select
            label={t("settings.backups.autoCooldown")}
            description={t("settings.backups.autoCooldownDescription")}
            value={settings.autoBackupCooldown}
            data={autoBackupCooldownOptions}
            allowDeselect={false}
            renderOption={Renderer}
            disabled={!settings.backupsEnabled || settings.autoBackupLimit === "disabled"}
            onChange={handleChange}
        />
    );
}

function Renderer({ option }: ComboboxLikeRenderOptionInput<ComboboxItem>): React.ReactNode {
    return <Text size="sm">{option.label}</Text>;
}
