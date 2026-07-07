import { GameBundle } from "../../shared/game-bundle/GameBundle";

export function findUserdataSource(gameBundles: GameBundle[], activeGameBundleId: string | undefined): GameBundle | null {
    return (activeGameBundleId === undefined ? undefined : gameBundles.find((gameBundle) => gameBundle.id === activeGameBundleId)) ?? gameBundles[0] ?? null;
}
