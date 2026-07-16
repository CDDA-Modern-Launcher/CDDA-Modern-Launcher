import App from "@renderer/App";
import React, { useEffect } from "react";
import { useConfigStore } from "@renderer/stores/useConfigStore";
import { useAppearanceStore } from "@renderer/stores/useAppearanceStore";
import { useModsStore } from "@renderer/stores/useModsStore";
import { useWorkspaceStore } from "@renderer/stores/useWorkspaceStore";
import { useLocaleStoreMount } from "@renderer/stores/useLocaleStore";
import { useGameRuntimeStatusMount } from "@renderer/stores/useGameRuntimeStore";
import { useGameStateStore } from "@renderer/stores/useGameStateStore";
import { useGameFileOperationStore } from "@renderer/stores/useGameFileOperationStore";
import { useGameBundleInstallStore } from "@renderer/stores/useGameBundleInstallStore";
import { useGameBackupStore } from "@renderer/stores/useGameBackupStore";

export function Root(): React.JSX.Element {
    // Appearance settings bridge
    const mountAppearance = useAppearanceStore((state) => state.mount);
    useEffect(() => mountAppearance(), [mountAppearance]);

    // Workspace settings bridge
    const mountConfig = useConfigStore((state) => state.mount);
    useEffect(() => mountConfig(), [mountConfig]);

    const mountLocale = useLocaleStoreMount();
    useEffect(() => mountLocale(), [mountLocale]);

    const mountWorkspace = useWorkspaceStore((state) => state.mount);
    useEffect(() => mountWorkspace(), [mountWorkspace]);

    const mountMods = useModsStore((state) => state.mount);
    useEffect(() => mountMods(), [mountMods]);

    const mountGameState = useGameStateStore((state) => state.mount);
    useEffect(() => mountGameState(), [mountGameState]);

    const mountGameFileOperation = useGameFileOperationStore((state) => state.mount);
    useEffect(() => mountGameFileOperation(), [mountGameFileOperation]);

    const mountGameBundleInstall = useGameBundleInstallStore((state) => state.mount);
    useEffect(() => mountGameBundleInstall(), [mountGameBundleInstall]);

    const mountGameBackup = useGameBackupStore((state) => state.mount);
    useEffect(() => mountGameBackup(), [mountGameBackup]);

    useGameRuntimeStatusMount();

    return <App />;
}
