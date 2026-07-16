import type React from "react";
import { Alert, Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { WORKSPACE_CONFIG_FILE_NAME } from "../../../../shared/Const";
import { useWorkspaceStore } from "@renderer/stores/useWorkspaceStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { LocalizedText } from "@renderer/components/LocalizedText";

export function WorkspaceInvalidView(): React.JSX.Element {
    const t = useTranslate();
    const workspace = useWorkspaceStore((state) => state.workspaceStatus);
    const isSelecting = useWorkspaceStore((state) => state.isSelectingWorkspace);
    const onSelectWorkspaceClick = useWorkspaceStore((state) => state.selectWorkspace);

    return (
        <Card withBorder radius="lg" p="xl" className="workspace-card">
            <Stack gap="lg">
                <Stack gap={4}>
                    <LocalizedText size="sm" c="dimmed" tt="uppercase" fw={700} className="eyebrow" i18nKey="workspace.setup.eyebrow" />
                    <Title order={1}>{t("workspace.setup.title")}</Title>
                    <LocalizedText c="dimmed" i18nKey="workspace.setup.description" />
                </Stack>
                {workspace.status === "invalid" && (
                    <Alert color="red" title={t("workspace.setup.invalid.title")} variant="light">
                        <Stack gap={6}>
                            {workspace.path.length > 0 && <Text size="sm">{workspace.path}</Text>}
                            <Text size="sm">{workspace.message}</Text>
                        </Stack>
                    </Alert>
                )}
                <Stack gap="xs" className="workspace-rules">
                    <LocalizedText size="sm" i18nKey="workspace.setup.rule.empty.folder" />
                    <LocalizedText size="sm" i18nKey="workspace.setup.rule.non.empty.folder" variables={{ fileName: WORKSPACE_CONFIG_FILE_NAME }} />
                    <LocalizedText size="sm" i18nKey="workspace.setup.rule.persisted.path" />
                </Stack>
                <Group justify="flex-end">
                    <Button loading={isSelecting} onClick={onSelectWorkspaceClick}>
                        {t("workspace.setup.select.button")}
                    </Button>
                </Group>
            </Stack>
        </Card>
    );
}
