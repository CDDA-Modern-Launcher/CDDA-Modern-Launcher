import React, { useCallback, useMemo } from "react";
import { Select } from "@mantine/core";
import { useConfigStore } from "@renderer/stores/useConfigStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { TReleaseAssetVariant } from "../../../shared/release-asset/TReleaseAssetVariant";

export function ReleaseAssertVariantView(): React.JSX.Element {
    const t = useTranslate();

    const releaseAssetVariant = useConfigStore((state) => state.releaseAssetVariant);
    const setReleaseAssetVariant = useConfigStore((state) => state.setReleaseAssetVariant);

    const data = useMemo(
        (): { value: TReleaseAssetVariant; label: string }[] => [
            { value: "graphics-and-sounds", label: t("settings.game.asset.variant.graphics.and.sounds") },
            { value: "graphics", label: t("settings.game.asset.variant.graphics") },
            { value: "tiles", label: t("settings.game.asset.variant.tiles") }
        ],
        [t]
    );

    const handleChange = useCallback(
        async (value: TReleaseAssetVariant | null) => {
            if (value) {
                await setReleaseAssetVariant(value);
            }
        },
        [setReleaseAssetVariant]
    );

    return <Select label={t("settings.game.asset.variant")} description={t("settings.game.asset.variant.description")} value={releaseAssetVariant} data={data} allowDeselect={false} onChange={handleChange} />;
}
