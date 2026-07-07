import { ReactNode } from "react";
import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useGameStateStore } from "@renderer/stores/useGameStateStore";
import { selectIsGameBundleInstallRunning, useGameBundleInstallStore } from "@renderer/stores/useGameBundleInstallStore";
import { useGameFileOperationStore } from "@renderer/stores/useGameFileOperationStore";
import { GithubRelease } from "../../../shared/GithubRelease";
import { useModalOpen } from "@renderer/modals/useModalStore";
import { useOpenDrawerSimple } from "@renderer/stores/useDrawerStore";

export function GameBundlePrompt(): ReactNode {
    const t = useTranslate();
    const openModal = useModalOpen();
    const openDrawer = useOpenDrawerSimple();

    const gameState = useGameStateStore((state) => state.state);
    const isInstallingGameBundle = useGameBundleInstallStore((state) => state.isInstalling);
    const fileOperationRunning = useGameFileOperationStore((state) => state.isRunning);
    const installLatestGameBundle = useGameBundleInstallStore((state) => state.installLatest);
    const installRunning = useGameBundleInstallStore(selectIsGameBundleInstallRunning);

    const latestRelease = gameState.status === "ready" ? gameState.latestRelease : null;
    const disabled = latestRelease === null || fileOperationRunning;
    const hasInstalledVersions = gameState.status === "ready" && gameState.gameBundles.length > 0;
    const description = latestRelease === null ? t("home.install.noRelease") : t("home.install.description");
    const activeGameBundle = gameState.status === "ready" ? gameState.gameBundle : null;

    const openInstallModal = (release: GithubRelease | null): void => {
        if (release === null) return;
        openModal({
            kind: "game-bundle-options",
            release,
            hasInstalledVersions,
            onConfirm: async (release, copyUserdata, removeOlderGameBundles) => {
                await installLatestGameBundle({ releaseId: release.id, makeActive: true, copyUserdata, removeOlderGameBundles });
            }
        });
    };

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
                    <Button size="xs" variant="subtle" onClick={() => openDrawer("game-bundles")}>
                        {t("home.action.chooseVersion")}
                    </Button>
                </Group>
            </Stack>
        </Alert>
    );
}
