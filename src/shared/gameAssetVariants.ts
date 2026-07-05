export type GameAssetVariant = "graphics-and-sounds" | "graphics" | "tiles";

export const DEFAULT_GAME_ASSET_VARIANT: GameAssetVariant = "graphics-and-sounds";

export const GAME_ASSET_VARIANT_FALLBACK_PRIORITY: readonly GameAssetVariant[] = ["graphics-and-sounds", "graphics", "tiles"];

export type LauncherUserSettings = {
    gameAssetVariant: GameAssetVariant;
};

export function isGameAssetVariant(value: unknown): value is GameAssetVariant {
    return value === "graphics-and-sounds" || value === "graphics" || value === "tiles";
}

export function getGameAssetVariantFallbackOrder(preferredVariant: GameAssetVariant): GameAssetVariant[] {
    return [preferredVariant, ...GAME_ASSET_VARIANT_FALLBACK_PRIORITY.filter((variant) => variant !== preferredVariant)];
}
