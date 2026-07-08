import { Alert, Button, Group, Paper, Progress, Stack, Text } from "@mantine/core";
import React, { useEffect, useMemo, useState } from "react";
import { TLocalizeFn, useTranslate } from "@renderer/stores/useLocaleStore";

type UpdateState = Awaited<ReturnType<typeof window.api.updater.getState>>;

function isVisibleState(state: UpdateState): boolean {
    return state.status !== "idle" && state.status !== "not-available" && state.status !== "skipped";
}

function getTitle(state: UpdateState, t: TLocalizeFn): string {
    switch (state.status) {
        case "checking":
            return t("updater.title.checking");
        case "available":
            return t("updater.title.available", { version: state.version });
        case "downloading":
            return t("updater.title.downloading", { version: state.version });
        case "downloaded":
            return t("updater.title.downloaded", { version: state.version });
        case "error":
            return t("updater.title.error");
        default:
            return "";
    }
}

function getDescription(state: UpdateState, t: TLocalizeFn): string {
    switch (state.status) {
        case "checking":
            return t("updater.description.checking");
        case "available":
            return t("updater.description.available");
        case "downloading":
            return t("updater.description.downloading", { percent: state.percent });
        case "downloaded":
            return t("updater.description.downloaded");
        case "error":
            return state.messageKey === undefined ? state.message : t(state.messageKey);
        default:
            return "";
    }
}

export function UpdateFloatingCard(): React.JSX.Element | null {
    const t = useTranslate();
    const [state, setState] = useState<UpdateState>({ status: "idle" });

    useEffect(() => {
        let mounted = true;

        window.api.updater.getState().then((initialState) => {
            if (mounted) {
                setState(initialState);
            }
        });

        const unsubscribe = window.api.updater.onStateChanged(setState);

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (state.status !== "not-available" && state.status !== "skipped") {
            return;
        }

        const timer = window.setTimeout(() => {
            setState({ status: "idle" });
        }, 1500);

        return () => window.clearTimeout(timer);
    }, [state]);

    const title = useMemo(() => getTitle(state, t), [state, t]);
    const description = useMemo(() => getDescription(state, t), [state, t]);

    if (!isVisibleState(state)) {
        return null;
    }

    return (
        <Paper
            withBorder
            shadow="lg"
            radius="md"
            p="md"
            style={{
                position: "fixed",
                top: 16,
                right: 16,
                zIndex: 1000,
                width: 360
            }}
        >
            <Stack gap="sm">
                {state.status === "error" ? (
                    <Alert color="red" title={title} variant="light">
                        {description}
                    </Alert>
                ) : (
                    <>
                        <Text fw={600}>{title}</Text>
                        <Text size="sm" c="dimmed">
                            {description}
                        </Text>
                    </>
                )}

                {state.status === "downloading" && <Progress value={state.percent} animated />}

                {state.status === "downloaded" && (
                    <Group justify="flex-end" gap="xs">
                        <Button variant="subtle" size="xs" onClick={() => window.api.updater.skipVersion(state.version)}>
                            {t("updater.action.skip", { version: state.version })}
                        </Button>
                        <Button variant="default" size="xs" onClick={() => window.api.updater.dismiss()}>
                            {t("updater.action.later")}
                        </Button>
                        <Button size="xs" onClick={() => window.api.updater.installNow()}>
                            {t("updater.action.restart.now")}
                        </Button>
                    </Group>
                )}

                {state.status === "error" && (
                    <Group justify="flex-end">
                        <Button variant="default" size="xs" onClick={() => window.api.updater.dismiss()}>
                            {t("updater.action.close")}
                        </Button>
                    </Group>
                )}
            </Stack>
        </Paper>
    );
}
