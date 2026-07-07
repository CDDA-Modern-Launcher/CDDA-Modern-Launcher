import type React from "react";
import { Card, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { REPOSITORY_CONFIG_FILE_NAME } from "../../../shared/Const";
import { useTranslate } from "@renderer/localization/useLocaleStore";

export function WorkspaceLoadingView({ path }: { path: string }): React.JSX.Element {
    const t = useTranslate();
    return (
        <Card withBorder radius="lg" p="xl" className="repository-card">
            <Group gap="lg" wrap="nowrap">
                <Loader />
                <Stack gap={2}>
                    <Title order={2}>{t("repository.loading.title")}</Title>
                    <Text c="dimmed">{t("repository.loading.description", { fileName: REPOSITORY_CONFIG_FILE_NAME })}</Text>
                    <Text size="sm" className="path-text">
                        {path}
                    </Text>
                </Stack>
            </Group>
        </Card>
    );
}
