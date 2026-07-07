import React, { useCallback } from "react";
import { useLocalization } from "@renderer/localization/LocalizationContext";
import { Switch, Tooltip } from "@mantine/core";
import { useConfigStore } from "@renderer/stores/useConfigStore";

export function BackupEnabledSwitch(): React.JSX.Element {
    const { t } = useLocalization();
    const backupsEnabled = useConfigStore((state) => state.backupsEnabled);
    const setBackupsEnabled = useConfigStore((state) => state.setBackupsEnabled);

    const handleChange = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            await setBackupsEnabled(event.currentTarget.checked);
        },
        [setBackupsEnabled]
    );

    return (
        <Tooltip label={t("settings.backups.enabledTooltip")}>
            <Switch aria-label={t("settings.backups.enabled")} checked={backupsEnabled} onChange={handleChange} />
        </Tooltip>
    );
}
