import type React from "react";
import { Card, Group, Progress, Stack, Text } from "@mantine/core";
import { getProgressTitle } from "@renderer/utils/getProgressTitle";
import { getIndeterminateProgressValue } from "@renderer/utils/getIndeterminateProgressValue";
import { getProgressDescription } from "@renderer/utils/getProgressDescription";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useGameBundleInstallStore } from "@renderer/stores/useGameBundleInstallStore";

export function GameBundleInstallProgressCard(): React.JSX.Element | null {
    const t = useTranslate();

    const progress = useGameBundleInstallStore((state) => state.progress);
    const isInstallingGameBundle = useGameBundleInstallStore((state) => state.isInstalling);

    if (!isInstallingGameBundle || progress.status === "idle") {
        return null;
    }

    const percent = progress.status === "downloading" || progress.status === "extracting" ? progress.percent : null;

    return (
        <Card withBorder radius="md" p="sm" className="game-bundle-install-progress-card">
            <Stack gap="xs">
                <Group justify="space-between" wrap="nowrap">
                    <Text size="sm" fw={700}>
                        {getProgressTitle(progress, t)}
                    </Text>
                    {percent !== null && <Text size="xs">{percent}%</Text>}
                </Group>
                <Progress value={percent ?? getIndeterminateProgressValue(progress)} animated={progress.status !== "completed" && progress.status !== "error"} />
                <Text size="xs" c="dimmed">
                    {getProgressDescription(progress, t)}
                </Text>
            </Stack>
        </Card>
    );
}
