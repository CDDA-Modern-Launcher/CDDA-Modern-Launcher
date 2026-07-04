import { useDisclosure } from "@mantine/hooks";
import React, { useState } from "react";

import { RepositoryGate } from "./components/RepositoryGate";
import { ContentSheet, type ContentSheetKind } from "./components/settings/ContentSheet";
import { SettingsSheet } from "./components/settings/SettingsSheet";
import { LauncherDock } from "./components/shell/LauncherDock";
import { UpdateFloatingCard } from "./components/UpdateFloatingCard";

export default function App(): React.JSX.Element {
    const [settingsOpened, settings] = useDisclosure(false);
    const [contentKind, setContentKind] = useState<ContentSheetKind | null>(null);

    const openContent = (kind: ContentSheetKind): void => {
        settings.close();
        setContentKind(kind);
    };

    const openSettings = (): void => {
        setContentKind(null);
        settings.toggle();
    };

    return (
        <>
            <UpdateFloatingCard />
            <SettingsSheet opened={settingsOpened} onClose={settings.close} />
            <ContentSheet kind={contentKind} onClose={() => setContentKind(null)} />

            <main className="app-shell">
                <RepositoryGate />
            </main>

            <LauncherDock
                onOpenSettings={openSettings}
                onOpenMods={() => openContent("mods")}
                onOpenSoundpack={() => openContent("soundpack")}
                onOpenTileset={() => openContent("tileset")}
            />
        </>
    );
}
