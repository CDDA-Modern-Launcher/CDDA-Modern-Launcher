import React, { useCallback, useState } from "react";
import { getReleaseNameDisplay } from "@renderer/utils/getReleaseNameDisplay";
import { Button, Checkbox, Group, Modal, Stack, Text, Title } from "@mantine/core";
import { defaultModalProps } from "@renderer/DefaultModalProps";
import { ModalPayload, useModalCloseWithLatch } from "@renderer/modals/useModalStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";

type Defined = Extract<ModalPayload, { kind: "game-bundle-options" }>;

interface Props {
    release: Defined["release"] | undefined;
    hasInstalledVersions: Defined["hasInstalledVersions"] | undefined;
    onConfirm: Defined["onConfirm"] | undefined;
}

export function GameBundleInstallOptionsModal({ release, hasInstalledVersions = false, onConfirm }: Props): React.JSX.Element {
    const t = useTranslate();
    const [close, latchedRelease, clean] = useModalCloseWithLatch(release);

    const releaseName = !latchedRelease ? "" : getReleaseNameDisplay(latchedRelease.name);

    return (
        <Modal {...defaultModalProps} opened={!!release} onClose={close} title={<Title order={4}>{t("install.modal.title")}</Title>} onExitTransitionEnd={clean}>
            {latchedRelease && (
                <GameBundleInstallOptionsModalContent
                    key={latchedRelease.id ?? latchedRelease.name}
                    release={latchedRelease}
                    releaseName={releaseName}
                    hasInstalledVersions={hasInstalledVersions}
                    onConfirm={onConfirm}
                    onClose={close}
                />
            )}
        </Modal>
    );
}

interface ContentProps extends Props {
    releaseName: string;
    onClose: () => void;
}

function GameBundleInstallOptionsModalContent({ release, releaseName, hasInstalledVersions, onConfirm, onClose }: ContentProps): React.JSX.Element {
    const t = useTranslate();
    const [installing, setInstalling] = useState(false);
    const [copy, setCopy] = useState(true);
    const [remove, setRemove] = useState(false);

    const handleConfirm = useCallback(async () => {
        try {
            if (!onConfirm || !release) return;
            setInstalling(true);
            void onConfirm(release, copy, remove);
            onClose();
        } finally {
            setInstalling(false);
        }
    }, [copy, onClose, onConfirm, release, remove]);

    return (
        <Stack gap="md">
            <Stack gap={4}>
                <Text size="sm" c="dimmed">
                    {t("install.modal.description", { version: releaseName })}
                </Text>

                <Text size="xs" c="dimmed">
                    {release?.asset?.name}
                </Text>
            </Stack>

            {hasInstalledVersions && (
                <Stack gap="xs" className="game-bundle-options">
                    <Checkbox size="sm" checked={copy} onChange={(event) => setCopy(event.currentTarget.checked)} label={t("install.option.copyUserdata")} />

                    <Checkbox size="sm" checked={remove} onChange={(event) => setRemove(event.currentTarget.checked)} label={t("install.option.removeOldVersions")} />
                </Stack>
            )}

            <Group justify="flex-end" gap="xs">
                <Button variant="subtle" onClick={onClose}>
                    {t("common.cancel")}
                </Button>

                <Button loading={installing} onClick={handleConfirm}>
                    {t("versions.action.install")}
                </Button>
            </Group>
        </Stack>
    );
}
