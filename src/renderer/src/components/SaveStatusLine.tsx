import { GameWorldInfo } from "../../../shared/GameWorldInfo";
import type React from "react";
import { Text } from "@mantine/core";
import { TLocalizeFn, useTranslate } from "@renderer/localization/useLocaleStore";

export function SaveStatusLine({ activeInstallAvailable, world, worldCount }: { activeInstallAvailable: boolean; world: GameWorldInfo | null; worldCount: number }): React.JSX.Element {
    const t = useTranslate();
    const text = getSaveStatusText(t, activeInstallAvailable, world, worldCount);
    return <Text c="dimmed">{text}</Text>;
}

function getSaveStatusText(t: TLocalizeFn, activeInstallAvailable: boolean, world: GameWorldInfo | null, worldCount: number): string {
    if (!activeInstallAvailable) return t("home.saveStatus.notInstalled");
    if (worldCount === 0) return t("home.saveStatus.noWorlds");
    if (world === null) return t("home.saveStatus.multipleWorlds", { count: worldCount.toString() });
    const character = world.characterName ?? t("home.world.unknown");
    return t("home.saveStatus.singleWorld", { world: world.name, character });
}
