import React, { useState } from "react";
import { Button, Checkbox, Group, Modal, Stack, Text, Title } from "@mantine/core";
import { getReleaseDisplayName } from "@renderer/utils/getReleaseDisplayName";
import { defaultModalProps } from "@renderer/DefaultModalProps";
import { ModalPayload, useModalCloseWithLatch } from "@renderer/modals/useModalStore";
import { useTranslate } from "@renderer/localization/useLocaleStore";

type Defined = Extract<ModalPayload, { kind: "delete-game-bundle" }>;

interface Props {
    gameBundle: Defined["gameBundle"] | undefined;
    onConfirm: Defined["onConfirm"] | undefined;
}

export function DeleteGameBundleModal({ gameBundle, onConfirm }: Props): React.JSX.Element {
    const t = useTranslate();
    const [close, _gameBundle, clean] = useModalCloseWithLatch(gameBundle);

    return (
        <Modal {...defaultModalProps} opened={!!gameBundle} onClose={close} title={<Title order={4}>{t("deleteGameBundle.modal.title")}</Title>} onExitTransitionEnd={clean}>
            <Content gameBundle={_gameBundle} onConfirm={onConfirm} onClose={close} key={_gameBundle?.id} />
        </Modal>
    );
}

interface ContentProps extends Props {
    onClose: () => void;
}

function Content({ gameBundle, onConfirm, onClose }: ContentProps): React.JSX.Element {
    const t = useTranslate();
    const [deleteUserdata, setDeleteUserdata] = useState(true);

    return (
        <Stack gap="md">
            <Text size="sm" c="dimmed">
                {!!gameBundle && t("deleteGameBundle.modal.description", { version: getReleaseDisplayName(gameBundle) })}
            </Text>
            <Checkbox size="sm" checked={deleteUserdata} onChange={(event) => setDeleteUserdata(event.currentTarget.checked)} label={t("versions.option.deleteUserdata")} />
            <Group justify="flex-end" gap="xs">
                <Button variant="subtle" onClick={onClose}>
                    {t("common.cancel")}
                </Button>
                <Button color="red" onClick={() => !!gameBundle && !!onConfirm && onConfirm(gameBundle, deleteUserdata)}>
                    {t("versions.action.delete")}
                </Button>
            </Group>
        </Stack>
    );
}
