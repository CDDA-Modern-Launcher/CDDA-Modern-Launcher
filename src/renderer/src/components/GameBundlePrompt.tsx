import type React from "react";
import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import { useTranslate } from "@renderer/localization/useLocaleStore";

type GameBundlePromptProps = {
    description: string;
    installLabel: string;
    loading: boolean;
    disabled: boolean;
    onInstall: () => void;
    onOpenVersions: () => void;
};

export function GameBundlePrompt(props: GameBundlePromptProps): React.JSX.Element {
    const t = useTranslate();
    return (
        <Alert variant="light" color="blue" title={t("home.install.title")}>
            <Stack gap="sm">
                <Text size="sm">{props.description}</Text>
                <Group gap="xs">
                    <Button size="xs" loading={props.loading} disabled={props.disabled} onClick={props.onInstall}>
                        {props.installLabel}
                    </Button>
                    <Button size="xs" variant="subtle" onClick={props.onOpenVersions}>
                        {t("home.action.chooseVersion")}
                    </Button>
                </Group>
            </Stack>
        </Alert>
    );
}
