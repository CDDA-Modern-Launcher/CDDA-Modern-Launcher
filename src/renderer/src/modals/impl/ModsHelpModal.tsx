import type { JSX } from "react";
import { Code, List, Stack, Text } from "@mantine/core";
import { useTranslate } from "@renderer/stores/useLocaleStore";

export function ModsHelpModal(): JSX.Element {
    const t = useTranslate();
    return (
        <Stack gap="md">
            <Text size="sm">{t("content.sheet.mods.help.intro")}</Text>
            <List size="sm" spacing="sm">
                <List.Item>
                    {t("content.sheet.mods.help.git")} <Code>https://github.com/owner/repository.git</Code>
                </List.Item>
                <List.Item>
                    {t("content.sheet.mods.help.layout")} <Code>modinfo.json</Code>
                </List.Item>
                <List.Item>{t("content.sheet.mods.help.archive")}</List.Item>
                <List.Item>{t("content.sheet.mods.help.folder")}</List.Item>
                <List.Item>{t("content.sheet.mods.help.attachments")}</List.Item>
            </List>
        </Stack>
    );
}
