import React, { useCallback } from "react";
import { useLocalization } from "@renderer/localization/LocalizationContext";
import { Switch, Tooltip } from "@mantine/core";
import { LauncherSettingsState } from "@renderer/hooks/useSettingsIPC";

export function BackupEnabledSwitch({ settings }: { settings: LauncherSettingsState }): React.JSX.Element {
    const { t } = useLocalization();

    const handleChange = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            try {
                return await settings.setBackupsEnabled(event.currentTarget.checked);
            } catch (error) {
                return console.error("Failed to set backups enabled", error);
            }
        },
        [settings]
    );

    return (
        <Tooltip label={t("settings.backups.enabledTooltip")}>
            <Switch aria-label={t("settings.backups.enabled")} checked={settings.backupsEnabled} onChange={handleChange} />
        </Tooltip>
    );
}
