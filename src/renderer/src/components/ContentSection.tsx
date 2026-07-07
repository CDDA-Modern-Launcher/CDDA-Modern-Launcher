import type React from "react";
import { Divider, Group, Stack, Text, Title } from "@mantine/core";

type ContentSectionProps = {
    title: string;
    description?: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
};

export function ContentSection({ title, description, actions, children }: ContentSectionProps): React.JSX.Element {
    return (
        <Stack gap="sm" className="settings-section">
            <Stack gap={2}>
                <Group justify="space-between" align="center" wrap="nowrap">
                    <Title order={4}>{title}</Title>
                    {actions !== undefined && actions}
                </Group>
                {description !== undefined && description.length > 0 && (
                    <Text size="sm" c="dimmed">
                        {description}
                    </Text>
                )}
            </Stack>
            <Stack gap="xs">{children}</Stack>
            <Divider />
        </Stack>
    );
}
