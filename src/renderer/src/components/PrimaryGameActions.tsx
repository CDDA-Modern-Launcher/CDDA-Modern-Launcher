import React from "react";
import { Button, Group } from "@mantine/core";
import { LastWorldButton } from "@renderer/components/LastWorldButton";
import { BackupCreateButton } from "@renderer/components/backups/BackupCreateButton";
import { useIsGameRunning } from "@renderer/stores/useGameRuntimeStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useGameStateStore } from "@renderer/stores/useGameStateStore";
import { useGameFileOperationStore } from "@renderer/stores/useGameFileOperationStore";
import { useGameCommandStore } from "@renderer/stores/useGameCommandStore";

export function PrimaryGameActions(): React.JSX.Element {
    const t = useTranslate();
    const gameState = useGameStateStore((state) => state.state);
    const fileOperationRunning = useGameFileOperationStore((state) => state.isRunning);
    const launchActiveGameBundle = useGameCommandStore((state) => state.launchActive);
    const stopGame = useGameCommandStore((state) => state.stop);
    const gameRunning = useIsGameRunning();

    const activeGameBundle = gameState.status === "ready" ? gameState.gameBundle : null;
    const saveSummary = gameState.status === "ready" ? gameState.saves : null;
    const worlds = saveSummary?.worlds ?? [];
    const currentWorld = saveSummary?.currentWorld ?? null;
    const launchDisabled = activeGameBundle === null || fileOperationRunning;

    const launchGame = async (worldName?: string): Promise<void> => {
        await launchActiveGameBundle(worldName === undefined ? {} : { worldName });
    };

    return (
        <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap="xs" wrap="wrap">
                <Button size="md" color={gameRunning ? "orange" : "green"} disabled={launchDisabled} leftSection={gameRunning ? "■" : "▶"} onClick={() => void (gameRunning ? stopGame() : launchGame())}>
                    {gameRunning ? t("home.action.stop") : t("home.action.play")}
                </Button>
                <LastWorldButton activeGameBundleAvailable={activeGameBundle !== null} gameRunning={gameRunning} actionDisabled={fileOperationRunning} worlds={worlds} currentWorld={currentWorld} onLaunch={launchGame} />
            </Group>

            <BackupCreateButton />
        </Group>
    );
}
