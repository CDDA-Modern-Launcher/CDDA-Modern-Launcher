import type React from "react";
import { Anchor, Box, Group, Modal, Stack, Text, Title } from "@mantine/core";
import { formatDate } from "@renderer/utils/formatDate";
import { defaultModalProps } from "@renderer/DefaultModalProps";
import { ModalPayload, useModalCloseWithLatch } from "@renderer/modals/useModalStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";

type Defined = Extract<ModalPayload, { kind: "release-notes" }>;

interface Props {
    notes: Defined["notes"] | undefined;
}

export function ReleaseNotesModal({ notes }: Props): React.JSX.Element {
    const t = useTranslate();
    const [close, _notes, clean] = useModalCloseWithLatch(notes);

    const body = _notes?.body.trim() ?? "";

    return (
        <Modal {...defaultModalProps} opened={!!notes} onClose={close} title={<Title order={4}>{notes?.title ?? t("releaseNotes.modal.title")}</Title>} size="xl" onExitTransitionEnd={clean}>
            <Stack gap="md">
                {!!_notes && (_notes.publishedAt !== undefined || _notes.htmlUrl !== undefined) && (
                    <Group gap="xs">
                        {_notes.publishedAt !== undefined && (
                            <Text size="xs" c="dimmed">
                                {t("releaseNotes.modal.publishedAt", { date: formatDate(_notes.publishedAt) })}
                            </Text>
                        )}
                        {_notes.htmlUrl !== undefined && (
                            <Anchor size="xs" component="button" type="button" onClick={() => void window.api.shell.openExternal(_notes.htmlUrl!)}>
                                {t("releaseNotes.modal.openOnGithub")}
                            </Anchor>
                        )}
                    </Group>
                )}
                {body.length === 0 ? (
                    <Text size="sm" c="dimmed">
                        {t("releaseNotes.modal.empty")}
                    </Text>
                ) : (
                    <Box component="pre" className="release-notes-text">
                        {body}
                    </Box>
                )}
            </Stack>
        </Modal>
    );
}
