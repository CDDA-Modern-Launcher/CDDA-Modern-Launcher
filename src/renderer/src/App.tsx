import React from "react";

import { WorkspaceView } from "./components/WorkspaceView";
import { LauncherDock } from "./components/LauncherDock";
import { UpdateFloatingCard } from "./components/UpdateFloatingCard";
import { ModalsProvider } from "@mantine/modals";
import { MantineProvider } from "@mantine/core";
import { useAppearanceStore } from "@renderer/stores/useAppearanceStore";
import { defaultModalProps } from "@renderer/DefaultModalProps";
import { ModalManager } from "@renderer/modals/ModalManager";
import { DrawerOwner } from "@renderer/components/DrawerOwner";

export default function App(): React.JSX.Element {
    const colorTheme = useAppearanceStore((state) => state.theme);
    return (
        <MantineProvider forceColorScheme={colorTheme}>
            <ModalsProvider modalProps={defaultModalProps}>
                <UpdateFloatingCard />

                <main className="app-shell">
                    <WorkspaceView />
                </main>

                <LauncherDock />

                <DrawerOwner />
                <ModalManager />
            </ModalsProvider>
        </MantineProvider>
    );
}
