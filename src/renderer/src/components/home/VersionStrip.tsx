import { Anchor, Button, Card, Group, Stack, Text } from "@mantine/core";
import type React from "react";
import { useState } from "react";

import { useLocalization } from "../../localization/LocalizationContext";
import { getReleaseNameDisplay, getUpdateAction } from "./homeUtils";
import { GithubRelease } from "../../../../shared/GithubRelease";

export function VersionStrip(props: {
    currentVersion: string;
    latestRelease: GithubRelease | null;
    latestReleaseError: string | null;
    updateAvailable: boolean;
    updateReleases: GithubRelease[];
    isChecking: boolean;
    isInstalling: boolean;
    isLoadingReleaseNotes: boolean;
    latestInstalledId: string | null;
    onInstall: () => void;
    onActivateLatest: (installId: string) => Promise<void>;
    onCheckAgain: () => Promise<void>;
    onOpenVersions: () => void;
    onShowUpdateChanges: () => void;
}): React.JSX.Element {
    const { t } = useLocalization();
    const [isActivatingLatest, setActivatingLatest] = useState(false);
    const updateAction = getUpdateAction(props.updateAvailable, props.latestRelease, props.latestInstalledId);

    const activateLatest = async (): Promise<void> => {
        if (props.latestInstalledId === null) return;
        setActivatingLatest(true);
        try {
            await props.onActivateLatest(props.latestInstalledId);
        } finally {
            setActivatingLatest(false);
        }
    };

    return (
        <Card withBorder radius="md" p="sm" className="home-version-strip">
            <Group justify="space-between" gap="sm" wrap="nowrap">
                <Stack gap={2} className="home-version-strip__text">
                    <Text size="sm" fw={700}>
                        {t("home.version.current", { version: props.currentVersion })}
                    </Text>
                    <Group gap={6} wrap="wrap">
                        <Text size="xs" c={props.latestReleaseError !== null ? "red" : props.updateAvailable ? "blue" : "dimmed"}>
                            {props.isChecking
                                ? t("home.version.checking")
                                : props.latestReleaseError !== null
                                  ? t("home.version.checkFailed", { message: props.latestReleaseError })
                                  : props.updateAvailable && props.latestRelease !== null
                                    ? t("home.version.updateAvailable", {
                                          currentVersion: props.currentVersion,
                                          latestVersion: getReleaseNameDisplay(props.latestRelease.name)
                                      })
                                    : props.latestRelease === null
                                      ? t("home.version.latestUnknown")
                                      : t("home.version.latestInstalled")}
                        </Text>
                        <Anchor component="button" type="button" size="xs" disabled={props.isChecking} onClick={() => void props.onCheckAgain()}>
                            {t("home.action.checkAgain")}
                        </Anchor>
                        {props.updateAvailable && props.latestRelease !== null && (
                            <Anchor component="button" type="button" size="xs" disabled={props.isLoadingReleaseNotes} onClick={props.onShowUpdateChanges}>
                                {props.isLoadingReleaseNotes ? t("home.action.loadingUpdateChanges") : t("home.action.showUpdateChanges")}
                            </Anchor>
                        )}
                    </Group>
                </Stack>
                <Group gap="xs" wrap="nowrap">
                    {updateAction === "activate" && (
                        <Button size="xs" variant="light" loading={isActivatingLatest} onClick={() => void activateLatest()}>
                            {t("home.action.activateLatest")}
                        </Button>
                    )}
                    {updateAction === "install" && (
                        <Button size="xs" variant="light" loading={props.isInstalling} onClick={props.onInstall}>
                            {t("home.action.installUpdate")}
                        </Button>
                    )}
                    <Button size="xs" variant="subtle" onClick={props.onOpenVersions}>
                        {t("home.action.openVersions")}
                    </Button>
                </Group>
            </Group>
        </Card>
    );
}
