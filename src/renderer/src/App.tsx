import React from "react";

import { WorkspaceView } from "./components/WorkspaceView";
import { LauncherDock } from "./components/LauncherDock";
import { UpdateFloatingCard } from "./components/UpdateFloatingCard";
import { ModalsProvider } from "@mantine/modals";
import { MantineProvider } from "@mantine/core";
import { useAppearanceStore } from "@renderer/stores/useAppearanceStore";
import { defaultModalProps } from "@renderer/utils/DefaultModalProps";
import { DrawerOwner } from "@renderer/components/DrawerOwner";
import { contextModals } from "@renderer/modals/contextModals";

export default function App(): React.JSX.Element {
    const colorTheme = useAppearanceStore((state) => state.theme);
    return (
        <MantineProvider forceColorScheme={colorTheme}>
            <ModalsProvider modalProps={defaultModalProps} modals={contextModals}>
                <UpdateFloatingCard />

                <main className="app-shell">
                    <WorkspaceView />
                </main>

                <LauncherDock />

                <DrawerOwner />
            </ModalsProvider>
        </MantineProvider>
    );
}
