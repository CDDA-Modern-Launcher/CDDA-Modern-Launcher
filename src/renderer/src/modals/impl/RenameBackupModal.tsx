import React, { useCallback, useState } from "react";
import { defaultModalProps } from "@renderer/DefaultModalProps";
import { Button, Group, Modal, Stack, Text, TextInput, Title } from "@mantine/core";
import { ModalPayload, useModalCloseWithLatch } from "@renderer/modals/useModalStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";

type Defined = Extract<ModalPayload, { kind: "rename-backup" }>;

interface Props {
    backup: Defined["backup"] | undefined;
    onConfirm: Defined["onConfirm"] | undefined;
}

export function RenameBackupModal({ backup, onConfirm }: Props): React.JSX.Element {
    const t = useTranslate();
    const [close, _backup, clean] = useModalCloseWithLatch(backup);

    return (
        <Modal {...defaultModalProps} opened={!!backup} onClose={close} title={<Title order={4}>{t("backup.rename.title")}</Title>} onExitTransitionEnd={clean}>
            <Content backup={_backup} onClose={close} onConfirm={onConfirm} key={_backup?.id} />
        </Modal>
    );
}

interface ContentProps extends Props {
    onClose: () => void;
}

function Content({ backup, onClose, onConfirm }: ContentProps): React.JSX.Element {
    const t = useTranslate();
    const [value, setValue] = useState(backup?.comment ?? "");

    const onConfirmClick = useCallback(
        async (event: React.SubmitEvent<HTMLFormElement>) => {
            event.preventDefault();
            onClose();
            if (!backup || !onConfirm) return;
            await onConfirm(backup, value);
        },
        [backup, onClose, onConfirm, value]
    );

    return (
        <form onSubmit={onConfirmClick}>
            <Stack gap="md">
                <TextInput label={t("backup.rename.label")} value={value} onChange={(event) => setValue(event.currentTarget.value)} data-autofocus />
                <Text size="xs" c="dimmed">
                    {t("backup.rename.description")}
                </Text>
                <Group justify="flex-end" gap="xs">
                    <Button variant="subtle" onClick={onClose}>
                        {t("common.cancel")}
                    </Button>
                    <Button type="submit">{t("backup.action.save")}</Button>
                </Group>
            </Stack>
        </form>
    );
}
