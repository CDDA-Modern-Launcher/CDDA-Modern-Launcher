import { Anchor, Button, Card, Group, Stack } from "@mantine/core";
import { ReactNode, useCallback, useMemo, useState } from "react";
import { getReleaseNameDisplay } from "@renderer/utils/getReleaseNameDisplay";
import { getUpdateAction } from "@renderer/utils/getUpdateAction";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useGameStateStore } from "@renderer/stores/useGameStateStore";
import { getReleaseDisplayName } from "@renderer/utils/getReleaseDisplayName";
import { selectIsGameBundleInstallRunning, useGameBundleInstallStore } from "@renderer/stores/useGameBundleInstallStore";
import { getUpdateReleases } from "@renderer/utils/getUpdateReleases";
import { useGameReleasesStore } from "@renderer/stores/useGameReleasesStore";
import { useGameFileOperationStore } from "@renderer/stores/useGameFileOperationStore";
import { GithubRelease } from "../../../shared/GithubRelease";
import { toUpdateReleaseNotesTarget } from "@renderer/utils/toUpdateReleaseNotesTarget";
import { openModal } from "@renderer/modals/contextModals";
import { LocalizedText } from "@renderer/components/LocalizedText";

export function VersionStrip(): ReactNode {
    const t = useTranslate();
    const gameState = useGameStateStore((state) => state.state);
    const installRunning = useGameBundleInstallStore(selectIsGameBundleInstallRunning);
    const availableReleases = useGameReleasesStore((state) => state.releases);
    const isCheckingLatest = useGameStateStore((state) => state.isCheckingLatest);
    const isInstallingGameBundle = useGameBundleInstallStore((state) => state.isInstalling);
    const isLoadingReleaseNotes = useGameReleasesStore((state) => state.isLoadingReleaseNotes);
    const fileOperationRunning = useGameFileOperationStore((state) => state.isRunning);
    const setActiveGameBundle = useGameBundleInstallStore((state) => state.setActive);
    const refreshGame = useGameStateStore((state) => state.refresh);
    const loadReleases = useGameReleasesStore((state) => state.load);
    const setReleaseNotesLoading = useGameReleasesStore((state) => state.setReleaseNotesLoading);

    const activeGameBundle = gameState.status === "ready" ? gameState.gameBundle : null;
    const latestRelease = gameState.status === "ready" ? gameState.latestRelease : null;
    const latestReleaseError = gameState.status === "ready" ? gameState.latestReleaseError : null;
    const updateAvailable = gameState.status === "ready" && gameState.updateAvailable;
    const hasInstalledVersions = gameState.status === "ready" && gameState.gameBundles.length > 0;

    const gameBundleIds = useMemo(() => new Set(gameState.status === "ready" ? gameState.gameBundles.map((gameBundle) => gameBundle.id) : []), [gameState]);
    const latestInstalledId = latestRelease !== null && gameBundleIds.has(latestRelease.id) ? latestRelease.id : null;

    // const updateReleases = useMemo(() => (activeGameBundle === null ? [] : getUpdateReleases(activeGameBundle, availableReleases)), [activeGameBundle, availableReleases]);

    const [isActivatingLatest, setActivatingLatest] = useState(false);

    const updateAction = getUpdateAction(updateAvailable, latestRelease, latestInstalledId);

    const openInstallModal = (release: GithubRelease | null): void => {
        if (release === null) return;
        openModal("installRelease", t("home.action.install.update"), { release, hasInstalledVersions });
    };
    const showUpdateChanges = useCallback(async (): Promise<void> => {
        if (activeGameBundle === null || latestRelease === null) return;

        let releases = availableReleases;
        if (releases.length === 0) {
            setReleaseNotesLoading(true);
            try {
                releases = await loadReleases();
            } finally {
                setReleaseNotesLoading(false);
            }
        }

        openModal("showReleaseNotes", t("release.notes.modal.title"), { notes: toUpdateReleaseNotesTarget(activeGameBundle, latestRelease, getUpdateReleases(activeGameBundle, releases), t) });
    }, [activeGameBundle, availableReleases, latestRelease, loadReleases, setReleaseNotesLoading, t]);

    const activateLatest = async (): Promise<void> => {
        if (latestInstalledId === null) return;
        setActivatingLatest(true);
        try {
            await setActiveGameBundle(latestInstalledId);
        } finally {
            setActivatingLatest(false);
        }
    };

    if (!activeGameBundle || installRunning) return null;
    const currentVersion = getReleaseDisplayName(activeGameBundle);

    return (
        <Card withBorder radius="md" p="sm" className="home-version-strip">
            <Group justify="space-between" gap="sm" wrap="nowrap">
                <Stack gap={2} className="home-version-strip__text">
                    <LocalizedText size="sm" fw={700} i18nKey="home.version.current" variables={{ version: currentVersion }} />

                    <Group gap={6} wrap="wrap">
                        {isCheckingLatest ? (
                            <LocalizedText size="xs" c="dimmed" i18nKey="home.version.checking" />
                        ) : latestReleaseError !== null ? (
                            <LocalizedText size="xs" c="red" i18nKey="home.version.check.failed" variables={{ message: latestReleaseError }} />
                        ) : updateAvailable && latestRelease !== null ? (
                            <LocalizedText size="xs" c="blue" i18nKey="home.version.update.available" variables={{ currentVersion: currentVersion, latestVersion: getReleaseNameDisplay(latestRelease.name) }} />
                        ) : latestRelease === null ? (
                            <LocalizedText size="xs" c="dimmed" i18nKey="home.version.latest.unknown" />
                        ) : (
                            <LocalizedText size="xs" c="dimmed" i18nKey="home.version.latest.installed" />
                        )}
                        <Anchor component="button" type="button" size="xs" disabled={isCheckingLatest || fileOperationRunning} onClick={() => void refreshGame(true, true)}>
                            {t("home.action.check.again")}
                        </Anchor>
                        {updateAvailable && latestRelease !== null && (
                            <Anchor component="button" type="button" size="xs" disabled={isLoadingReleaseNotes || fileOperationRunning} onClick={showUpdateChanges}>
                                {isLoadingReleaseNotes ? t("home.action.loading.update.changes") : t("home.action.show.update.changes")}
                            </Anchor>
                        )}
                    </Group>
                </Stack>

                <Group gap="xs" wrap="nowrap">
                    {updateAction === "activate" && (
                        <Button size="xs" variant="gradient" loading={isActivatingLatest} disabled={fileOperationRunning} onClick={() => void activateLatest()}>
                            {t("home.action.activate.latest")}
                        </Button>
                    )}

                    {updateAction === "install" && (
                        <Button size="xs" variant="gradient" loading={isInstallingGameBundle} disabled={fileOperationRunning} onClick={() => openInstallModal(latestRelease)}>
                            {t("home.action.install.update")}
                        </Button>
                    )}
                </Group>
            </Group>
        </Card>
    );
}
