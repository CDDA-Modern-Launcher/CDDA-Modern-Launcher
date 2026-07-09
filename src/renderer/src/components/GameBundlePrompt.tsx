import { ReactNode, useCallback } from "react";
import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useGameStateStore } from "@renderer/stores/useGameStateStore";
import { selectIsGameBundleInstallRunning, useGameBundleInstallStore } from "@renderer/stores/useGameBundleInstallStore";
import { useGameFileOperationStore } from "@renderer/stores/useGameFileOperationStore";
import { GithubRelease } from "../../../shared/GithubRelease";
import { useOpenDrawer } from "@renderer/stores/useDrawerStore";
import { openModal } from "@renderer/modals/contextModals";

export function GameBundlePrompt(): ReactNode {
    const t = useTranslate();
    const openGameBundlesDrawer = useOpenDrawer("game-bundles");

    const gameState = useGameStateStore((state) => state.state);
    const isInstallingGameBundle = useGameBundleInstallStore((state) => state.isInstalling);
    const fileOperationRunning = useGameFileOperationStore((state) => state.isRunning);
    const installRunning = useGameBundleInstallStore(selectIsGameBundleInstallRunning);

    const latestRelease = gameState.status === "ready" ? gameState.latestRelease : null;
    const disabled = latestRelease === null || fileOperationRunning;
    const hasInstalledVersions = gameState.status === "ready" && gameState.gameBundles.length > 0;
    const description = latestRelease === null ? t("home.install.no.release") : t("home.install.description");
    const activeGameBundle = gameState.status === "ready" ? gameState.gameBundle : null;

    const openInstallModal = useCallback(
        (release: GithubRelease | null): void => {
            if (release === null) return;
            openModal("installRelease", t("home.action.install.update"), { release, hasInstalledVersions });
        },
        [hasInstalledVersions, t]
    );

    if (activeGameBundle != null || gameState.status !== "ready" || installRunning) {
        return null;
    }

    return (
        <Alert variant="light" color="blue" title={t("home.install.title")}>
            <Stack gap="sm">
                <Text size="sm">{description}</Text>
                <Group gap="xs">
                    <Button size="xs" loading={isInstallingGameBundle} disabled={disabled} onClick={() => openInstallModal(latestRelease)}>
                        {t("home.action.install")}
                    </Button>
                    <Button size="xs" variant="subtle" onClick={openGameBundlesDrawer}>
                        {t("home.action.choose.version")}
                    </Button>
                </Group>
            </Stack>
        </Alert>
    );
}
