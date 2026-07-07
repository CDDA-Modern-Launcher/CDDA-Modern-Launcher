import React, { useCallback, useMemo } from "react";
import { Select } from "@mantine/core";
import { isReleaseAssetVariant } from "../../../shared/release-asset/isReleaseAssetVariant";
import { useConfigStore } from "@renderer/stores/useConfigStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";

export function ReleaseAssertVariantView(): React.JSX.Element {
    const t = useTranslate();

    const releaseAssetVariant = useConfigStore((state) => state.releaseAssetVariant);
    const setReleaseAssetVariant = useConfigStore((state) => state.setReleaseAssetVariant);

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
                await setReleaseAssetVariant(value);
            }
        },
        [setReleaseAssetVariant]
    );

    return <Select label={t("settings.game.assetVariant")} description={t("settings.game.assetVariantDescription")} value={releaseAssetVariant} data={data} allowDeselect={false} onChange={handleChange} />;
}
