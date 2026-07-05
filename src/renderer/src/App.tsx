import { useDisclosure } from "@mantine/hooks";
import React, { useEffect, useState } from "react";

import { RepositoryStatus } from "../../shared/repository";
import { RepositoryGate } from "./components/RepositoryGate";
import { ContentSheet, type ContentSheetKind } from "./components/settings/ContentSheet";
import { SettingsSheet } from "./components/settings/SettingsSheet";
import { LauncherDock } from "./components/shell/LauncherDock";
import { UpdateFloatingCard } from "./components/UpdateFloatingCard";

export default function App(): React.JSX.Element {
    const [settingsOpened, settings] = useDisclosure(false);
    const [contentKind, setContentKind] = useState<ContentSheetKind | null>(null);
    const [repository, setRepository] = useState<RepositoryStatus>({ status: "unconfigured" });
    const [isSelectingRepository, setSelectingRepository] = useState(false);

    useEffect(() => {
        let mounted = true;

        window.api.repository.getStatus().then((status) => {
            if (mounted) {
                setRepository(status);
            }
        });

        return () => {
            mounted = false;
        };
    }, []);

    const selectRepository = async (): Promise<void> => {
        setSelectingRepository(true);

        try {
            const result = await window.api.repository.selectFolder();

            if (result.status === "selected") {
                setRepository(result.repository);
            }
        } finally {
            setSelectingRepository(false);
        }
    };

    const setSelectedChannel = async (channelId: string): Promise<void> => {
        setRepository(await window.api.repository.setSelectedChannel(channelId));
    };

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
            <ContentSheet repository={repository} kind={contentKind} onClose={() => setContentKind(null)} />

            <main className="app-shell">
                <RepositoryGate repository={repository} isSelecting={isSelectingRepository} onSelectRepository={selectRepository} />
            </main>

            <LauncherDock
                repository={repository}
                onSelectChannel={setSelectedChannel}
                onOpenSettings={openSettings}
                onOpenMods={() => openContent("mods")}
                onOpenSoundpack={() => openContent("soundpack")}
                onOpenTileset={() => openContent("tileset")}
            />
        </>
    );
}
