import React, { useCallback, useMemo } from "react";
import { Select } from "@mantine/core";
import { useLocalization } from "@renderer/localization/LocalizationContext";
import { LauncherSettingsState } from "@renderer/hooks/useSettingsIPC";
import { isReleaseAssetVariant } from "../../../../shared/release-asset/isReleaseAssetVariant";

export function ReleaseAssertVariant({ settings }: { settings: LauncherSettingsState }): React.JSX.Element {
    const { t } = useLocalization();
    const data = useMemo(
        () => [
            { value: "graphics-and-sounds", label: t("settings.game.assetVariant.graphicsAndSounds") },
            { value: "graphics", label: t("settings.game.assetVariant.graphics") },
            { value: "tiles", label: t("settings.game.assetVariant.tiles") }
        ],
        [t]
    );

    const handleChange = useCallback(
        async (value: string | null) => {
            if (isReleaseAssetVariant(value)) {
                try {
                    return await settings.setGameAssetVariant(value);
                } catch (error) {
                    console.error("Failed to set release asset variant", error);
                }
            }
        },
        [settings]
    );

    return <Select label={t("settings.game.assetVariant")} description={t("settings.game.assetVariantDescription")} value={settings.releaseAssetVariant} data={data} allowDeselect={false} onChange={handleChange} />;
}
