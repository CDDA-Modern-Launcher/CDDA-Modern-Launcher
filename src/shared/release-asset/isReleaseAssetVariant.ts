import { TReleaseAssetVariant } from "./TReleaseAssetVariant";

export function isReleaseAssetVariant(value: unknown): value is TReleaseAssetVariant {
    return value === "graphics-and-sounds" || value === "graphics" || value === "tiles";
}
