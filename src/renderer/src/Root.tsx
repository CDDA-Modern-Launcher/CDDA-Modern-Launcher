import App from "@renderer/App";
import React, { useEffect } from "react";
import { useConfigStore } from "@renderer/stores/useConfigStore";
import { useAppearanceStore } from "@renderer/stores/useAppearanceStore";
import { useModsSheetStore } from "@renderer/stores/useModsSheetStore";
import { useWorkspaceStore } from "@renderer/stores/useWorkspaceStore";
import { useLocaleStoreMount } from "@renderer/localization/useLocaleStore";

export function Root(): React.JSX.Element {
    // Appearance settings bridge
    const mountAppearance = useAppearanceStore((state) => state.mount);
    useEffect(() => mountAppearance(), [mountAppearance]);

    // Repository settings bridge
    const mountConfig = useConfigStore((state) => state.mount);
    useEffect(() => mountConfig(), [mountConfig]);

    const mountLocale = useLocaleStoreMount();
    useEffect(() => mountLocale(), [mountLocale]);

    const mountWorkspace = useWorkspaceStore((state) => state.mount);
    useEffect(() => mountWorkspace(), [mountWorkspace]);

    const mountMods = useModsSheetStore((state) => state.mount);
    useEffect(() => mountMods(), [mountMods]);

    return <App />;
}
