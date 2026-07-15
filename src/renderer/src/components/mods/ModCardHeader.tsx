import React, { ReactNode, useMemo } from "react";
import { Anchor, Badge, Group, Stack, Text, Tooltip } from "@mantine/core";
import { ModInstanceInfo } from "../../../../shared/mods/ModInstanceInfo";
import { getModStatusColor } from "@renderer/utils/getModStatusColor";
import { getModStatusKey } from "@renderer/utils/getModStatusKey";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { openUrl } from "@renderer/utils/openUrl";
import { ModCardActions } from "@renderer/components/mods/ModCardActions";

interface Props {
    mod: ModInstanceInfo;
}

export const ModCardHeader = React.memo(function ModCardHeader({ mod }: Props): ReactNode {
    const t = useTranslate();

    const details = useMemo(
        () =>
            [
                `Mod ID: ${mod.id}`,
                `Source: ${mod.sourceType}`,
                mod.sourceUrl ? `Git URL: ${mod.sourceUrl}` : undefined,
                mod.subdirectory ? `Subdirectory: ${mod.subdirectory}` : undefined,
                mod.defaultBranch ? `Remote branch: ${mod.defaultBranch}` : undefined
            ]
                .filter(Boolean)
                .join("\n"),
        [mod]
    );

    const title = useMemo(
        () =>
            mod.sourceType === "git" && mod.sourceUrl ? (
                <Anchor fw={700} onClick={() => openUrl(mod.sourceUrl!)}>
                    {mod.displayName}
                </Anchor>
            ) : (
                <Text fw={700}>{mod.displayName}</Text>
            ),
        [mod]
    );

    return (
        <Group wrap="nowrap" justify="space-between" align="flex-start">
            <Stack gap={4} style={{ minWidth: 0 }}>
                <Group gap="xs" wrap="wrap">
                    <Tooltip
                        label={
                            <Text size="xs" style={{ whiteSpace: "pre-line" }}>
                                {details}
                            </Text>
                        }
                    >
                        {title}
                    </Tooltip>
                    <Badge size="sm" color={getModStatusColor(mod)} variant="light">
                        {t(getModStatusKey(mod))}
                    </Badge>
                    <Badge size="xs" variant="outline">
                        {t(`content.sheet.mods.source.${mod.sourceType}`)}
                    </Badge>
                </Group>
                {mod.description && (
                    <Text size="sm" c="dimmed" lineClamp={3}>
                        {mod.description}
                    </Text>
                )}
            </Stack>

            <ModCardActions mod={mod} />
        </Group>
    );
});
