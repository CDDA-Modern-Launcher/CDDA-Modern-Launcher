import { WorkspaceStatus } from "../../../shared/workspace/WorkspaceStatus";
import type React from "react";
import { useLocalization } from "@renderer/localization/LocalizationContext";
import { Alert, Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { REPOSITORY_CONFIG_FILE_NAME } from "../../../shared/Const";

interface Props {
    workspace: Extract<WorkspaceStatus, { status: "unconfigured" | "invalid" }>;
    isSelecting: boolean;
    onSelectRepositoryClick: () => void;
}

export function InvalidWorkspaceView({ workspace, isSelecting, onSelectRepositoryClick }: Props): React.JSX.Element {
    const { t } = useLocalization();
    return (
        <Card withBorder radius="lg" p="xl" className="repository-card">
            <Stack gap="lg">
                <Stack gap={4}>
                    <Text size="sm" c="dimmed" tt="uppercase" fw={700} className="eyebrow">
                        {t("repository.setup.eyebrow")}
                    </Text>
                    <Title order={1}>{t("repository.setup.title")}</Title>
                    <Text c="dimmed">{t("repository.setup.description")}</Text>
                </Stack>
                {workspace.status === "invalid" && (
                    <Alert color="red" title={t("repository.setup.invalidTitle")} variant="light">
                        <Stack gap={6}>
                            {workspace.path.length > 0 && <Text size="sm">{workspace.path}</Text>}
                            <Text size="sm">{workspace.message}</Text>
                        </Stack>
                    </Alert>
                )}
                <Stack gap="xs" className="repository-rules">
                    <Text size="sm">{t("repository.setup.rule.emptyFolder")}</Text>
                    <Text size="sm">
                        {t("repository.setup.rule.nonEmptyFolder.prefix")} <code>{REPOSITORY_CONFIG_FILE_NAME}</code>.
                    </Text>
                    <Text size="sm">{t("repository.setup.rule.persistedPath")}</Text>
                </Stack>
                <Group justify="flex-end">
                    <Button loading={isSelecting} onClick={onSelectRepositoryClick}>
                        {t("repository.setup.selectButton")}
                    </Button>
                </Group>
            </Stack>
        </Card>
    );
}
