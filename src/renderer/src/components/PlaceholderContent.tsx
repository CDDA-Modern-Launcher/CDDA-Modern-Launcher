import type React from "react";
import { useLocalization } from "@renderer/localization/LocalizationContext";
import { Alert, Button, Stack, Text } from "@mantine/core";

import { ContentSection } from "@renderer/components/ContentSection";
import { TContentSheetKind } from "@renderer/types/TContentSheetKind";

const contentPrimaryActionKeyByKind: Record<TContentSheetKind, string> = {
    mods: "contentSheet.mods.primaryAction",
    soundpack: "contentSheet.soundpack.primaryAction",
    tileset: "contentSheet.tileset.primaryAction"
};

const contentDescriptionKeyByKind: Record<TContentSheetKind, string> = {
    mods: "contentSheet.mods.description",
    soundpack: "contentSheet.soundpack.description",
    tileset: "contentSheet.tileset.description"
};

export function PlaceholderContent({ kind, selectedChannelName }: { kind: TContentSheetKind; selectedChannelName: string | null }): React.JSX.Element {
    const { t } = useLocalization();

    return (
        <Stack gap="xl">
            <ContentSection title={t("contentSheet.library.title")} description={t(contentDescriptionKeyByKind[kind])}>
                <Alert variant="light" color="blue" title={t("contentSheet.placeholder.title")}>
                    <Stack gap={4}>
                        <Text size="sm">{t("contentSheet.placeholder.description")}</Text>
                        <Text size="sm" c="dimmed">
                            {selectedChannelName === null ? t("contentSheet.context.unavailable") : t("contentSheet.context.selected", { channel: selectedChannelName })}
                        </Text>
                    </Stack>
                </Alert>
                <Button variant="light" disabled>
                    {t(contentPrimaryActionKeyByKind[kind])}
                </Button>
            </ContentSection>
        </Stack>
    );
}
