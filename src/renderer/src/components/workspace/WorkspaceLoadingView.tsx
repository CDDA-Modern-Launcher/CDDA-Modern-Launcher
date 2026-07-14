import type React from "react";
import { Card, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { WORKSPACE_CONFIG_FILE_NAME } from "../../../../shared/Const";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { LocalizedText } from "@renderer/components/LocalizedText";

export function WorkspaceLoadingView({ path }: { path: string }): React.JSX.Element {
    const t = useTranslate();
    return (
        <Card withBorder radius="lg" p="xl" className="workspace-card">
            <Group gap="lg" wrap="nowrap">
                <Loader />
                <Stack gap={2}>
                    <Title order={2}>{t("repository.loading.title")}</Title>
                    <LocalizedText c="dimmed" i18nKey="repository.loading.description" variables={{ fileName: WORKSPACE_CONFIG_FILE_NAME }} />
                    <Text size="sm" className="path-text">
                        {path}
                    </Text>
                </Stack>
            </Group>
        </Card>
    );
}
