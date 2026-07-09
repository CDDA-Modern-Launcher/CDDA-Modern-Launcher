import { ReactNode } from "react";
import { BackupsDrawer } from "@renderer/components/BackupsDrawer";
import { SettingsDrawer } from "@renderer/components/SettingsDrawer";
import { ModsDrawer } from "@renderer/components/mods/ModsDrawer";
import { GameBundlesDrawer } from "@renderer/components/GameBundlesDrawer";

export function DrawerOwner(): ReactNode {
    return (
        <>
            <BackupsDrawer />
            <SettingsDrawer />
            <ModsDrawer />
            <GameBundlesDrawer />
        </>
    );
}
