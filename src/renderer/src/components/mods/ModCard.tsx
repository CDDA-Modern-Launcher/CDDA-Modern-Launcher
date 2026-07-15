import { ModInstanceInfo } from "../../../../shared/mods/ModInstanceInfo";
import React from "react";
import { Card, Stack, Text } from "@mantine/core";
import { LocalizedText } from "@renderer/components/LocalizedText";
import { ModCardHeader } from "@renderer/components/mods/ModCardHeader";

interface Props {
    mod: ModInstanceInfo;
}

export const ModCard = React.memo(function ModCard({ mod }: Props) {
    return (
        <Card withBorder radius="md" p="md">
            <Stack gap="xs">
                <ModCardHeader mod={mod} />
                {mod.error && (
                    <Text size="sm" c="red">
                        {mod.error}
                    </Text>
                )}
                {mod.hasLocalChanges && <LocalizedText size="sm" c="orange" i18nKey="content.sheet.mods.local.changes" />}
                {mod.updateAvailable && <LocalizedText size="sm" c="blue" i18nKey="content.sheet.mods.update.available" />}
            </Stack>
        </Card>
    );
});
