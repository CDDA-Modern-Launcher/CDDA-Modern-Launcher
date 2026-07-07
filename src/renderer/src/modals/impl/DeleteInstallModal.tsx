import React, { useState } from "react";
import { Button, Checkbox, Group, Modal, Stack, Text, Title } from "@mantine/core";
import { getReleaseDisplayName } from "@renderer/utils/getReleaseDisplayName";
import { defaultModalProps } from "@renderer/DefaultModalProps";
import { ModalPayload, useModalCloseWithLatch } from "@renderer/modals/useModalStore";
import { useTranslate } from "@renderer/localization/useLocaleStore";

type Defined = Extract<ModalPayload, { kind: "delete-install" }>;

interface Props {
    distributive: Defined["distributive"] | undefined;
    onConfirm: Defined["onConfirm"] | undefined;
}

export function DeleteInstallModal({ distributive, onConfirm }: Props): React.JSX.Element {
    const t = useTranslate();
    const [close, _distributive, clean] = useModalCloseWithLatch(distributive);

    return (
        <Modal {...defaultModalProps} opened={!!distributive} onClose={close} title={<Title order={4}>{t("deleteInstall.modal.title")}</Title>} onExitTransitionEnd={clean}>
            <Content distributive={_distributive} onConfirm={onConfirm} onClose={close} key={_distributive?.id} />
        </Modal>
    );
}

interface ContentProps extends Props {
    onClose: () => void;
}

function Content({ distributive, onConfirm, onClose }: ContentProps): React.JSX.Element {
    const t = useTranslate();
    const [deleteUserdata, setDeleteUserdata] = useState(true);

    return (
        <Stack gap="md">
            <Text size="sm" c="dimmed">
                {!!distributive && t("deleteInstall.modal.description", { version: getReleaseDisplayName(distributive) })}
            </Text>
            <Checkbox size="sm" checked={deleteUserdata} onChange={(event) => setDeleteUserdata(event.currentTarget.checked)} label={t("versions.option.deleteUserdata")} />
            <Group justify="flex-end" gap="xs">
                <Button variant="subtle" onClick={onClose}>
                    {t("common.cancel")}
                </Button>
                <Button color="red" onClick={() => !!distributive && !!onConfirm && onConfirm(distributive, deleteUserdata)}>
                    {t("versions.action.delete")}
                </Button>
            </Group>
        </Stack>
    );
}
