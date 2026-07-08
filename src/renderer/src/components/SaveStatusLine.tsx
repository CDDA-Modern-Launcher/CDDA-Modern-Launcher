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
    if (!activeGameBundleAvailable) return t("home.save.status.no.game.bundle");
    if (worldCount === 0) return t("home.save.status.no.worlds");
    if (world === null) return t("home.save.status.multiple.worlds", { count: worldCount.toString() });
    const character = world.characterName ?? t("home.world.unknown");
    return t("home.save.status.single.world", { world: world.name, character });
}
