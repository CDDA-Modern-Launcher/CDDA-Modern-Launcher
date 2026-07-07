import React from "react";
import { Button, Group, Modal, Stack, Text, Title } from "@mantine/core";
import { defaultModalProps } from "@renderer/DefaultModalProps";
import { ModalPayload, useModalCloseWithLatch } from "@renderer/modals/useModalStore";
import { useTranslate } from "@renderer/localization/useLocaleStore";

type Defined = Extract<ModalPayload, { kind: "delete-backup" }>;

interface Props {
    backup: Defined["backup"] | undefined;
    onConfirm: Defined["onConfirm"] | undefined;
}

export function DeleteBackupModal({ backup, onConfirm }: Props): React.JSX.Element {
    const t = useTranslate();
    const [close, _backup, clean] = useModalCloseWithLatch(backup);

    return (
        <Modal {...defaultModalProps} opened={backup !== undefined} onClose={close} title={<Title order={4}>{t("backup.delete.title")}</Title>} onExitTransitionEnd={clean}>
            <Stack gap="md">
                <Text size="sm">
                    {!_backup
                        ? ""
                        : t("backup.delete.description", {
                              title: _backup.comment.trim().length === 0 ? t("backup.latest.title") : _backup.comment,
                              world: _backup.worldName,
                              character: _backup.characterName
                          })}
                </Text>
                <Text size="xs" c="dimmed">
                    {t("backup.delete.shiftHint")}
                </Text>
                <Group justify="flex-end" gap="xs">
                    <Button variant="subtle" onClick={close}>
                        {t("common.cancel")}
                    </Button>
                    <Button color="red" onClick={() => !!backup && onConfirm?.(backup)}>
                        {t("backup.action.delete")}
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}
