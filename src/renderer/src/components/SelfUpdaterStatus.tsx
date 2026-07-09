import React, { useCallback, useEffect, useState } from "react";
import { UpdateState } from "../../../shared/bridge-api/types/UpdateState";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { NotificationData, notifications } from "@mantine/notifications";
import { getErrorMessage } from "../../../shared/getErrorMessage";
import { Button, Group, Progress, Stack, Text } from "@mantine/core";
import { formatBytes } from "@renderer/utils/formatBytes";

const noticeId = "self-update";
let isNoticeOpen = false;

function setNoticeClosed(): void {
    isNoticeOpen = false;
}

function getDownloadingDescription(state: Extract<UpdateState, { status: "downloading" }>, t: ReturnType<typeof useTranslate>): string {
    if (state.transferredBytes !== undefined && state.totalBytes !== undefined) {
        return t("updater.description.downloading.with.size", {
            percent: state.percent,
            size: formatBytes(state.transferredBytes),
            total: formatBytes(state.totalBytes)
        });
    }

    if (state.totalBytes !== undefined) {
        return t("updater.description.downloading.total.size", {
            percent: state.percent,
            total: formatBytes(state.totalBytes)
        });
    }

    return t("updater.description.downloading", { percent: state.percent });
}

export function SelfUpdaterStatus(): React.JSX.Element | null {
    const t = useTranslate();
    const [state, setState] = useState<UpdateState>({ status: "idle" });

    useEffect(() => {
        window.api.updater.getState().then(setState);
        const unsubscribe = window.api.updater.onStateChanged(setState);
        return function cleanup() {
            unsubscribe();
            isNoticeOpen = false;
            notifications.hide(noticeId);
        };
    }, []);

    const dismiss = useCallback(async () => {
        try {
            const state = await window.api.updater.dismiss();
            setState(state);
        } catch (e) {
            setState({ status: "error", message: getErrorMessage(e) });
        }
    }, []);

    const skipVersion = useCallback(async (version: string) => {
        try {
            const state = await window.api.updater.skipVersion(version);
            setState(state);
        } catch (e) {
            setState({ status: "error", message: getErrorMessage(e) });
        }
    }, []);

    const download = useCallback(async () => {
        try {
            const state = await window.api.updater.downloadNow();
            setState(state);
        } catch (e) {
            setState({ status: "error", message: getErrorMessage(e) });
        }
    }, []);

    const install = useCallback(async () => {
        try {
            await window.api.updater.installNow();
        } catch (e) {
            setState({ status: "error", message: getErrorMessage(e) });
        }
    }, []);

    const showOrUpdate = useCallback((data: NotificationData) => {
        if (isNoticeOpen) {
            notifications.update({
                ...data,
                onClose: setNoticeClosed
            });
        } else {
            isNoticeOpen = true;
            notifications.show({
                ...data,
                onClose: setNoticeClosed
            });
        }
    }, []);

    useEffect(() => {
        switch (state.status) {
            case "idle":
            case "checking":
                isNoticeOpen = false;
                notifications.hide(noticeId);
                break;
            case "available":
                showOrUpdate({
                    id: noticeId,
                    title: t("updater.title.available", { version: state.version }),
                    message: (
                        <Stack gap="xs">
                            <Text size="sm">{t("updater.description.available")}</Text>
                            <Group gap="xs" justify="flex-end">
                                <Button size="xs" onClick={download}>
                                    {t("updater.action.download")}
                                </Button>
                                <Button size="xs" variant="subtle" onClick={() => skipVersion(state.version)}>
                                    {t("updater.action.skip", { version: state.version })}
                                </Button>
                            </Group>
                        </Stack>
                    ),
                    autoClose: false,
                    withCloseButton: true,
                    closeButtonProps: { onClick: dismiss },
                    color: "blue",
                    withBorder: true
                });
                break;
            case "downloading":
                showOrUpdate({
                    id: noticeId,
                    title: t("updater.title.downloading", { version: state.version }),
                    message: (
                        <Stack gap="xs" style={{ marginTop: 5 }}>
                            <Progress value={state.percent} size="sm" animated />
                            <Text size="sm">{getDownloadingDescription(state, t)}</Text>
                        </Stack>
                    ),
                    autoClose: false,
                    withCloseButton: false,
                    loading: true,
                    color: "blue",
                    withBorder: true
                });
                break;
            case "downloaded":
                showOrUpdate({
                    id: noticeId,
                    title: t("updater.title.downloaded", { version: state.version }),
                    message: (
                        <Stack gap="xs">
                            <Text size="sm">{t("updater.description.downloaded")}</Text>
                            <Group gap="xs" justify="flex-end">
                                <Button size="xs" onClick={install}>
                                    {t("updater.action.restart.now")}
                                </Button>
                            </Group>
                        </Stack>
                    ),
                    autoClose: false,
                    color: "blue",
                    withBorder: true
                });
                break;
            case "not-available":
                break;
            case "skipped":
                break;
            case "error":
                showOrUpdate({
                    id: noticeId,
                    title: t("updater.title.error"),
                    message: state.messageKey === undefined ? state.message : t(state.messageKey),
                    autoClose: 10000,
                    withCloseButton: true,
                    color: "red",
                    withBorder: true
                });
                break;
        }
    }, [dismiss, download, install, showOrUpdate, skipVersion, state, t]);

    return null;
}
