import { GameWorldInfo } from "../../../shared/GameWorldInfo";
import type React from "react";
import { Text } from "@mantine/core";
import { TLocalizeFn, useTranslate } from "@renderer/stores/useLocaleStore";
import { useGameStateStore } from "@renderer/stores/useGameStateStore";

export function SaveStatusLine(): React.JSX.Element {
    const t = useTranslate();

    const gameState = useGameStateStore((state) => state.state);

    const activeGameBundle = gameState.status === "ready" ? gameState.gameBundle : null;
    const activeGameBundleAvailable = activeGameBundle !== null;
    const saveSummary = gameState.status === "ready" ? gameState.saves : null;
    const worlds = saveSummary?.worlds ?? [];
    const currentWorld = saveSummary?.currentWorld ?? null;
    const worldCount = worlds.length;

    const text = getSaveStatusText(t, activeGameBundleAvailable, currentWorld, worldCount);

    return <Text c="dimmed">{text}</Text>;
}

function getSaveStatusText(t: TLocalizeFn, activeGameBundleAvailable: boolean, world: GameWorldInfo | null, worldCount: number): string {
    if (!activeGameBundleAvailable) return t("home.saveStatus.noGameBundle");
    if (worldCount === 0) return t("home.saveStatus.noWorlds");
    if (world === null) return t("home.saveStatus.multipleWorlds", { count: worldCount.toString() });
    const character = world.characterName ?? t("home.world.unknown");
    return t("home.saveStatus.singleWorld", { world: world.name, character });
}
