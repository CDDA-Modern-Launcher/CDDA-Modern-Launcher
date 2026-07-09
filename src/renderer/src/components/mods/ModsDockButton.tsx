import "./ModsDockButton.css";
import React from "react";
import { ModRepositoryState } from "../../../../shared/mods/ModRepositoryState";
import { useModsStore } from "@renderer/stores/useModsStore";
import { useOpenDrawer } from "@renderer/stores/useDrawerStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { Button } from "@mantine/core";

export function ModsDockButton(): React.JSX.Element | null {
    const t = useTranslate();
    const modRepositoryState = useModsStore((state) => state.state);
    const modIndicatorState = getModIndicatorState(modRepositoryState);
    const openModsDrawer = useOpenDrawer("mods");

    return (
        <Button variant="light" size="xs" radius="md" onClick={openModsDrawer} className="launcher-dock__button launcher-dock__mods-button">
            {t("dock.mods")}
            {modIndicatorState !== "idle" && <span className={`launcher-dock__mods-indicator launcher-dock__mods-indicator--${modIndicatorState}`} aria-hidden="true" />}
        </Button>
    );
}

function getModIndicatorState(state: ModRepositoryState): "idle" | "checking" | "updates" {
    if (state.status !== "ready") return "idle";
    if (state.mods.some((mod) => mod.updateAvailable)) return "updates";
    if (state.checking) return "checking";
    return "idle";
}
