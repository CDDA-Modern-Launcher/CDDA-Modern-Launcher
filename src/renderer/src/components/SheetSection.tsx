import React from "react";
import { Divider, Group, Stack, Title } from "@mantine/core";

type SheetSectionProps = {
    title: string;
    children: React.ReactNode;
    rightSection?: React.ReactNode;
};

export function SheetSection({ title, children, rightSection }: SheetSectionProps): React.JSX.Element {
    return (
        <Stack gap="sm" className="settings-section">
            <Group justify="space-between" align="center" wrap="nowrap">
                <Title order={4}>{title}</Title>
                {rightSection}
            </Group>
            <Stack gap="xs">{children}</Stack>
            <Divider />
        </Stack>
    );
}
