import type React from "react";
import { Alert, Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { REPOSITORY_CONFIG_FILE_NAME } from "../../../shared/Const";
import { useWorkspaceStore } from "@renderer/stores/useWorkspaceStore";
import { useTranslate } from "@renderer/localization/useLocaleStore";

export function WorkspaceInvalidView(): React.JSX.Element {
    const t = useTranslate();
    const repository = useWorkspaceStore((state) => state.workspaceStatus);
    const isSelecting = useWorkspaceStore((state) => state.isSelectingRepository);
    const onSelectRepositoryClick = useWorkspaceStore((state) => state.selectRepository);

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
                {repository.status === "invalid" && (
                    <Alert color="red" title={t("repository.setup.invalidTitle")} variant="light">
                        <Stack gap={6}>
                            {repository.path.length > 0 && <Text size="sm">{repository.path}</Text>}
                            <Text size="sm">{repository.message}</Text>
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
