import type React from "react";
import { Anchor, Box, Group, Stack } from "@mantine/core";
import { formatDate } from "@renderer/utils/formatDate";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { ContextModalProps } from "@mantine/modals";
import { ReleaseNotesTarget } from "@renderer/types/ReleaseNotesTarget";
import { LocalizedText } from "@renderer/components/LocalizedText";

export function ReleaseNotesModal({ innerProps: { notes } }: ContextModalProps<{ notes: ReleaseNotesTarget }>): React.JSX.Element {
    const t = useTranslate();

    const body = notes?.body.trim() ?? "";

    return (
        <Stack gap="md">
            {(notes.publishedAt !== undefined || notes.htmlUrl !== undefined) && (
                <Group gap="xs">
                    {notes.publishedAt !== undefined && <LocalizedText size="xs" c="dimmed" i18nKey="release.notes.modal.published.at" variables={{ date: formatDate(notes.publishedAt) }} />}
                    {notes.htmlUrl !== undefined && (
                        <Anchor size="xs" component="button" type="button" onClick={() => void window.api.shell.openExternal(notes.htmlUrl!)}>
                            {t("release.notes.modal.open.on.github")}
                        </Anchor>
                    )}
                </Group>
            )}

            {body.length === 0 ? (
                <LocalizedText size="sm" c="dimmed" i18nKey="release.notes.modal.empty" />
            ) : (
                <Box component="pre" className="release-notes-text">
                    {body}
                </Box>
            )}
        </Stack>
    );
}
