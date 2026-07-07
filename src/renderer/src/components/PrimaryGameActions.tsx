import React from "react";
import { Button, Group } from "@mantine/core";
import { LastWorldButton } from "@renderer/components/LastWorldButton";
import { BackupCreateButton } from "@renderer/components/BackupCreateButton";
import { useGameRuntimeState } from "@renderer/stores/useGameRuntimeStore";
import { useTranslate } from "@renderer/localization/useLocaleStore";
import { useGameBundleStore } from "@renderer/stores/useGameBundleStore";

export function PrimaryGameActions(): React.JSX.Element {
    const t = useTranslate();
    const runtimeState = useGameRuntimeState();
    const gameState = useGameBundleStore((state) => state.state);
    const backupProgress = useGameBundleStore((state) => state.backupProgress);
    const fileOperationRunning = useGameBundleStore((state) => state.isFileOperationRunning);
    const launchActiveGameBundle = useGameBundleStore((state) => state.launchActiveGameBundle);
    const stopGame = useGameBundleStore((state) => state.stopGame);
    const createManualBackup = useGameBundleStore((state) => state.createManualBackup);

    const activeGameBundle = gameState.status === "ready" ? gameState.gameBundle : null;
    const saveSummary = gameState.status === "ready" ? gameState.saves : null;
    const worlds = saveSummary?.worlds ?? [];
    const currentWorld = saveSummary?.currentWorld ?? null;
    const gameRunning = runtimeState.status === "running";
    const savesStable = gameState.status !== "ready" || gameState.savesStable;
    const backupBusy = backupProgress.status === "creating" || backupProgress.status === "restoring" || fileOperationRunning;
    const launchDisabled = activeGameBundle === null || fileOperationRunning;

    const launchGame = async (worldName?: string): Promise<void> => {
        await launchActiveGameBundle(worldName === undefined ? {} : { worldName });
    };

    const createBackup = async (worldName?: string): Promise<void> => {
        await createManualBackup(worldName === undefined ? {} : { worldName });
    };

    return (
        <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap="xs" wrap="wrap">
                <Button size="md" color={gameRunning ? "orange" : "green"} disabled={launchDisabled} leftSection={gameRunning ? "■" : "▶"} onClick={() => void (gameRunning ? stopGame() : launchGame())}>
                    {gameRunning ? t("home.action.stop") : t("home.action.play")}
                </Button>
                <LastWorldButton activeGameBundleAvailable={activeGameBundle !== null} gameRunning={gameRunning} actionDisabled={fileOperationRunning} worlds={worlds} currentWorld={currentWorld} onLaunch={launchGame} />
            </Group>
            <BackupCreateButton activeGameBundleAvailable={activeGameBundle !== null} worlds={worlds} currentWorld={currentWorld} savesStable={savesStable} backupBusy={backupBusy} onCreate={createBackup} />
        </Group>
    );
}
