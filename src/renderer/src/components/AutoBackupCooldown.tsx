import React, { useCallback, useMemo } from "react";
import { ComboboxItem, ComboboxLikeRenderOptionInput, Select, Text } from "@mantine/core";
import { useConfigStore } from "@renderer/stores/useConfigStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { TAutoBackupCooldown } from "../../../shared/backups/types/TAutoBackupCooldown";

export function AutoBackupCooldown(): React.JSX.Element {
    const t = useTranslate();

    const autoBackupCooldown = useConfigStore((state) => state.autoBackupCooldown);
    const backupsEnabled = useConfigStore((state) => state.backupsEnabled);
    const autoBackupLimit = useConfigStore((state) => state.autoBackupLimit);

    const setAutoBackupCooldown = useConfigStore((state) => state.setAutoBackupCooldown);

    const autoBackupCooldownOptions = useMemo(
        (): { value: TAutoBackupCooldown; label: string }[] => [
            { value: "disabled", label: t("settings.backups.cooldown.no.pause") },
            { value: "5s", label: t("settings.backups.cooldown.5s") },
            { value: "15s", label: t("settings.backups.cooldown.15s") },
            { value: "1m", label: t("settings.backups.cooldown.1m") }
        ],
        [t]
    );

    const handleChange = useCallback(
        async (value: TAutoBackupCooldown | null) => {
            if (value) {
                await setAutoBackupCooldown(value);
            }
        },
        [setAutoBackupCooldown]
    );

    return (
        <Select
            label={t("settings.backups.auto.cooldown")}
            description={t("settings.backups.auto.cooldown.description")}
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
