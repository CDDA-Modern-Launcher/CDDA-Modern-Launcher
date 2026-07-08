import React, { useCallback } from "react";
import { Switch, Tooltip } from "@mantine/core";
import { useConfigStore } from "@renderer/stores/useConfigStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";

export function BackupEnabledSwitch(): React.JSX.Element {
    const t = useTranslate();
    const backupsEnabled = useConfigStore((state) => state.backupsEnabled);
    const setBackupsEnabled = useConfigStore((state) => state.setBackupsEnabled);

    const handleChange = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            await setBackupsEnabled(event.currentTarget.checked);
        },
        [setBackupsEnabled]
    );

    return (
        <Tooltip label={t("settings.backups.enabled.tooltip")}>
            <Switch aria-label={t("settings.backups.enabled")} checked={backupsEnabled} onChange={handleChange} />
        </Tooltip>
    );
}
