import { InstallDistributiveProgress } from "../../../shared/distributive/InstallDistributiveProgress";
import type React from "react";
import { Card, Group, Progress, Stack, Text } from "@mantine/core";
import { getProgressTitle } from "@renderer/utils/getProgressTitle";
import { getIndeterminateProgressValue } from "@renderer/utils/getIndeterminateProgressValue";
import { getProgressDescription } from "@renderer/utils/getProgressDescription";
import { useTranslate } from "@renderer/localization/useLocaleStore";

export function InstallProgressCard({ progress }: { progress: InstallDistributiveProgress }): React.JSX.Element {
    const t = useTranslate();
    const percent = progress.status === "downloading" || progress.status === "extracting" ? progress.percent : null;
    return (
        <Card withBorder radius="md" p="sm" className="install-progress-card">
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
