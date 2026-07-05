import { TReleaseAssetVariant } from "./TReleaseAssetVariant";

const RELEASE_ASSET_VARIANT_FALLBACK_PRIORITY: readonly TReleaseAssetVariant[] = ["graphics-and-sounds", "graphics", "tiles"];

export function getReleaseAssetVariantFallbackOrder(preferredVariant: TReleaseAssetVariant): TReleaseAssetVariant[] {
    return [preferredVariant, ...RELEASE_ASSET_VARIANT_FALLBACK_PRIORITY.filter((variant) => variant !== preferredVariant)];
}
