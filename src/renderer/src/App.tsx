import { useDisclosure } from "@mantine/hooks";
import React, { useState } from "react";

import { WorkspaceView } from "./components/WorkspaceView";
import { ContentSheet } from "./components/ContentSheet";
import { SettingsSheet } from "./components/SettingsSheet";
import { LauncherDock } from "./components/LauncherDock";
import { UpdateFloatingCard } from "./components/UpdateFloatingCard";
import { TContentSheetKind } from "@renderer/types/TContentSheetKind";
import { ModalsProvider } from "@mantine/modals";
import { LocalizationProvider } from "@renderer/localization/LocalizationProvider";
import { MantineProvider } from "@mantine/core";
import { useAppearanceStore } from "@renderer/stores/useAppearanceStore";
import { defaultModalProps } from "@renderer/DefaultModalProps";
import { ModalManager } from "@renderer/modals/ModalManager";

export default function App(): React.JSX.Element {
    const colorTheme = useAppearanceStore((state) => state.theme);

    const [settingsOpened, settings] = useDisclosure(false);
    const [contentKind, setContentKind] = useState<TContentSheetKind | null>(null);

    const openContent = (kind: TContentSheetKind): void => {
        settings.close();
        setContentKind(kind);
    };

    const openSettings = (): void => {
        setContentKind(null);
        settings.toggle();
    };

    return (
        <MantineProvider forceColorScheme={colorTheme}>
            <ModalsProvider modalProps={defaultModalProps}>
                <LocalizationProvider>
                    <UpdateFloatingCard />

                    <SettingsSheet opened={settingsOpened} onClose={settings.close} />

                    <ContentSheet kind={contentKind} onClose={() => setContentKind(null)} />

                    <main className="app-shell">
                        <WorkspaceView />
                    </main>

                    <LauncherDock onOpenSettings={openSettings} onOpenMods={() => openContent("mods")} onOpenSoundpack={() => openContent("soundpack")} onOpenTileset={() => openContent("tileset")} />

                    <ModalManager />
                </LocalizationProvider>
            </ModalsProvider>
        </MantineProvider>
    );
}
