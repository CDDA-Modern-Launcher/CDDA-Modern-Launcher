import React from "react";

import { WorkspaceView } from "./components/workspace/WorkspaceView";
import { AppBottomDock } from "./components/AppBottomDock";
import { UpdateFloatingCard } from "./components/UpdateFloatingCard";
import { ModalsProvider } from "@mantine/modals";
import { MantineProvider } from "@mantine/core";
import { useAppearanceStore } from "@renderer/stores/useAppearanceStore";
import { defaultModalProps } from "@renderer/utils/DefaultModalProps";
import { DrawerOwner } from "@renderer/components/DrawerOwner";
import { contextModals } from "@renderer/modals/contextModals";
import { useIsLocaleLoaded } from "@renderer/stores/useLocaleStore";
import { useIsWorkspaceLoaded } from "@renderer/stores/useWorkspaceStore";
import { useConfigStore } from "@renderer/stores/useConfigStore";

function StartupScreen(): React.JSX.Element {
    return <div className="app-startup-screen" />;
}

export default function App(): React.JSX.Element {
    const colorTheme = useAppearanceStore((state) => state.theme);
    const isLocaleLoaded = useIsLocaleLoaded();
    const isWorkspaceLoaded = useIsWorkspaceLoaded();
    const isConfigLoaded = useConfigStore((state) => state.isLoaded);
    const isReady = isLocaleLoaded && isWorkspaceLoaded && isConfigLoaded;

    return (
        <MantineProvider forceColorScheme={colorTheme}>
            <ModalsProvider modalProps={defaultModalProps} modals={contextModals}>
                {isReady ? (
                    <>
                        <UpdateFloatingCard />

                        <main className="app-shell">
                            <WorkspaceView />
                        </main>

                        <AppBottomDock />

                        <DrawerOwner />
                    </>
                ) : (
                    <StartupScreen />
                )}
            </ModalsProvider>
        </MantineProvider>
    );
}
