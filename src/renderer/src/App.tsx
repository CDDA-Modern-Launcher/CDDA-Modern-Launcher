import { ReactNode } from "react";
import { WorkspaceView } from "./components/workspace/WorkspaceView";
import { AppBottomDock } from "./components/AppBottomDock";
import { ModalsProvider } from "@mantine/modals";
import { MantineProvider } from "@mantine/core";
import { useAppearanceStore } from "@renderer/stores/useAppearanceStore";
import { defaultModalProps } from "@renderer/utils/DefaultModalProps";
import { DrawerOwner } from "@renderer/components/DrawerOwner";
import { contextModals } from "@renderer/modals/contextModals";
import { Notifications } from "@mantine/notifications";
import { SelfUpdaterStatus } from "@renderer/components/SelfUpdaterStatus";

export default function App(): ReactNode {
    const colorTheme = useAppearanceStore((state) => state.theme);
    return (
        <MantineProvider forceColorScheme={colorTheme}>
            <ModalsProvider modalProps={defaultModalProps} modals={contextModals}>
                <Notifications position="top-right" />

                <SelfUpdaterStatus />

                <main className="app-shell">
                    <WorkspaceView />
                </main>

                <AppBottomDock />

                <DrawerOwner />
            </ModalsProvider>
        </MantineProvider>
    );
}
