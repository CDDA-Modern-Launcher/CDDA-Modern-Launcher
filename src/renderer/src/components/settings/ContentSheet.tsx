import { Alert, Button, Divider, Drawer, Group, Stack, Text, Title } from "@mantine/core";
import React from "react";

import { useLocalization } from "../../localization/LocalizationContext";

export type ContentSheetKind = "mods" | "soundpack" | "tileset";

type ContentSheetProps = {
    kind: ContentSheetKind | null;
    onClose: () => void;
};

export function ContentSheet({ kind, onClose }: ContentSheetProps): React.JSX.Element {
    const { t } = useLocalization();
    const opened = kind !== null;
    const effectiveKind = kind ?? "mods";

    return (
        <Drawer opened={opened} onClose={onClose} position="right" size={420} title={<Title order={3}>{t(contentTitleKeyByKind[effectiveKind])}</Title>}>
            <Stack gap="xl">
                <ContentSection title={t("contentSheet.library.title")} description={t(contentDescriptionKeyByKind[effectiveKind])}>
                    <Alert variant="light" color="blue" title={t("contentSheet.placeholder.title")}>
                        {t("contentSheet.placeholder.description")}
                    </Alert>
                    <Button variant="light" disabled>
                        {t(contentPrimaryActionKeyByKind[effectiveKind])}
                    </Button>
                </ContentSection>

                <ContentSection title={t("contentSheet.selection.title")} description={t("contentSheet.selection.description")}>
                    <Button variant="subtle" disabled>
                        {t("contentSheet.selection.openFolder")}
                    </Button>
                    <Button variant="subtle" disabled>
                        {t("contentSheet.selection.refresh")}
                    </Button>
                </ContentSection>
            </Stack>
        </Drawer>
    );
}

const contentTitleKeyByKind: Record<ContentSheetKind, string> = {
    mods: "contentSheet.mods.title",
    soundpack: "contentSheet.soundpack.title",
    tileset: "contentSheet.tileset.title"
};

const contentDescriptionKeyByKind: Record<ContentSheetKind, string> = {
    mods: "contentSheet.mods.description",
    soundpack: "contentSheet.soundpack.description",
    tileset: "contentSheet.tileset.description"
};

const contentPrimaryActionKeyByKind: Record<ContentSheetKind, string> = {
    mods: "contentSheet.mods.primaryAction",
    soundpack: "contentSheet.soundpack.primaryAction",
    tileset: "contentSheet.tileset.primaryAction"
};

type ContentSectionProps = {
    title: string;
    description: string;
    children: React.ReactNode;
};

function ContentSection({ title, description, children }: ContentSectionProps): React.JSX.Element {
    return (
        <Stack gap="sm" className="settings-section">
            <Stack gap={2}>
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Title order={4}>{title}</Title>
                </Group>
                <Text size="sm" c="dimmed">
                    {description}
                </Text>
            </Stack>
            <Stack gap="xs">{children}</Stack>
            <Divider />
        </Stack>
    );
}
