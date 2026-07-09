import type React from "react";
import { Anchor, Box, Code, Group, Stack, Text } from "@mantine/core";
import { formatDate } from "@renderer/utils/formatDate";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { ContextModalProps } from "@mantine/modals";
import { ReleaseNotesTarget } from "@renderer/types/ReleaseNotesTarget";
import { LocalizedText } from "@renderer/components/LocalizedText";
import { openUrl } from "@renderer/utils/openUrl";

type ReleaseNotesCard = {
    title: string;
    publishedAt?: string;
    fullChangelogUrl?: string;
    lines: string[];
};

function stripMarkdownInline(text: string): string {
    return text
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/__([^_]+)__/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/_([^_]+)_/g, "$1")
        .trim();
}

function isReleaseDivider(line: string): boolean {
    return /^[─-]{8,}$/.test(line.trim());
}

function trimOuterBlankLines(lines: string[]): string[] {
    let start = 0;
    let end = lines.length;

    while (start < end && lines[start].trim().length === 0) start += 1;
    while (end > start && lines[end - 1].trim().length === 0) end -= 1;

    return lines.slice(start, end);
}

function splitReleaseSegments(body: string): string[][] {
    const segments: string[][] = [];
    let currentSegment: string[] = [];

    for (const rawLine of body.replace(/\r\n/g, "\n").split("\n")) {
        const line = rawLine.trimEnd();

        if (isReleaseDivider(line)) {
            if (currentSegment.some((segmentLine) => segmentLine.trim().length > 0)) {
                segments.push(trimOuterBlankLines(currentSegment));
            }
            currentSegment = [];
            continue;
        }

        currentSegment.push(line);
    }

    if (currentSegment.some((line) => line.trim().length > 0)) {
        segments.push(trimOuterBlankLines(currentSegment));
    }

    return segments;
}

function stripTrailingUrlPunctuation(rawUrl: string): string {
    return rawUrl.replace(/[),.;:]+$/, "");
}

function isWhatsChangedHeading(line: string): boolean {
    const text = stripMarkdownInline(line);
    const heading = text.match(/^#{1,6}\s+(.+)$/);
    const title = heading === null ? text : heading[1].trim();

    return title === "What's Changed";
}

function extractFullChangelogUrl(line: string): string | undefined {
    const text = stripMarkdownInline(line);
    const match = text.match(/^Full Changelog:\s+(https?:\/\/\S+)$/i);

    return match === null ? undefined : stripTrailingUrlPunctuation(match[1]);
}

function extractPublishedAtLine(line: string): string | undefined {
    const text = stripMarkdownInline(line);
    const match = text.match(/^[^:]+:\s+\d{2}\.\d{2}\.\d{4},\s+\d{2}:\d{2}:\d{2}$/);

    return match === null ? undefined : text;
}

function parseReleaseNotesCards(body: string, fallbackTitle: string): ReleaseNotesCard[] {
    return splitReleaseSegments(body).map((segment) => {
        const lines = [...segment];
        const firstHeading = lines[0]?.match(/^#{1,4}\s+(.+)$/);
        const title = firstHeading === null || firstHeading === undefined ? fallbackTitle : stripMarkdownInline(firstHeading[1]);

        if (firstHeading !== null && firstHeading !== undefined) {
            lines.shift();
        }

        const firstMeaningfulLineIndex = lines.findIndex((line) => line.trim().length > 0);
        const firstMeaningfulLine = firstMeaningfulLineIndex === -1 ? undefined : extractPublishedAtLine(lines[firstMeaningfulLineIndex]);
        const publishedAt = firstMeaningfulLine;

        if (publishedAt !== undefined) {
            lines.splice(firstMeaningfulLineIndex, 1);
        }

        const fullChangelogLineIndex = lines.findIndex((line) => extractFullChangelogUrl(line) !== undefined);
        const fullChangelogUrl = fullChangelogLineIndex === -1 ? undefined : extractFullChangelogUrl(lines[fullChangelogLineIndex]);

        if (fullChangelogLineIndex !== -1) {
            lines.splice(fullChangelogLineIndex, 1);
        }

        return {
            title,
            ...(publishedAt === undefined ? {} : { publishedAt }),
            ...(fullChangelogUrl === undefined ? {} : { fullChangelogUrl }),
            lines: trimOuterBlankLines(lines.filter((line) => !isWhatsChangedHeading(line)))
        };
    });
}

function getReleaseNotesLinkLabel(url: string): string {
    const pullRequestMatch = url.match(/\/pull\/(\d+)(?:[/?#].*)?$/);
    if (pullRequestMatch !== null) return `#${pullRequestMatch[1]}`;

    const issueMatch = url.match(/\/issues\/(\d+)(?:[/?#].*)?$/);
    if (issueMatch !== null) return `#${issueMatch[1]}`;

    return "Changes";
}

function renderExternalLink(url: string, label: React.ReactNode, className?: string, key?: React.Key): React.JSX.Element {
    return (
        <Anchor key={key} component="button" type="button" onClick={() => openUrl(url)} className={className}>
            {label}
        </Anchor>
    );
}

function renderReleaseNotesInlineText(text: string): React.ReactNode {
    const nodes: React.ReactNode[] = [];
    const authorLinkPattern = /\s+by\s+@([A-Za-z0-9-]+)\s+in\s+(https?:\/\/\S+)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = authorLinkPattern.exec(text)) !== null) {
        const [matchedText, author, rawUrl] = match;
        const textBeforeMatch = text.slice(lastIndex, match.index);
        const url = stripTrailingUrlPunctuation(rawUrl);
        const trailingPunctuation = rawUrl.slice(url.length);

        if (textBeforeMatch.length > 0) nodes.push(textBeforeMatch);

        nodes.push(" ");
        nodes.push(
            <Code key={`author-${match.index}`} className="release-notes-card__author">
                {author}
            </Code>
        );
        nodes.push(" ");
        nodes.push(renderExternalLink(url, getReleaseNotesLinkLabel(url), "release-notes-card__inline-link", `link-${match.index}`));
        if (trailingPunctuation.length > 0) nodes.push(trailingPunctuation);

        lastIndex = match.index + matchedText.length;
    }

    const tail = text.slice(lastIndex);
    if (tail.length > 0) nodes.push(tail);

    return nodes.length === 0 ? text : nodes;
}

function renderReleaseNotesLine(line: string, index: number): React.JSX.Element | null {
    const text = stripMarkdownInline(line);
    if (text.length === 0) return null;

    const heading = text.match(/^#{1,6}\s+(.+)$/);
    if (heading !== null) {
        return (
            <Text key={index} size="sm" fw={600} className="release-notes-card__section-title">
                {heading[1]}
            </Text>
        );
    }

    const bullet = text.match(/^[-*]\s+(.+)$/);
    if (bullet !== null) {
        return (
            <Group key={index} gap="xs" align="flex-start" wrap="nowrap" className="release-notes-card__line">
                <Text size="sm" c="dimmed" component="span" className="release-notes-card__marker">
                    •
                </Text>
                <Text size="sm" component="span" className="release-notes-card__line-text">
                    {renderReleaseNotesInlineText(bullet[1])}
                </Text>
            </Group>
        );
    }

    const numbered = text.match(/^(\d+[.)])\s+(.+)$/);
    if (numbered !== null) {
        return (
            <Group key={index} gap="xs" align="flex-start" wrap="nowrap" className="release-notes-card__line">
                <Text size="sm" c="dimmed" component="span" className="release-notes-card__marker">
                    {numbered[1]}
                </Text>
                <Text size="sm" component="span" className="release-notes-card__line-text">
                    {renderReleaseNotesInlineText(numbered[2])}
                </Text>
            </Group>
        );
    }

    return (
        <Text key={index} size="sm" className="release-notes-card__line-text">
            {renderReleaseNotesInlineText(text)}
        </Text>
    );
}

export function ReleaseNotesModal({ innerProps: { notes } }: ContextModalProps<{ notes: ReleaseNotesTarget }>): React.JSX.Element {
    const t = useTranslate();

    const body = notes?.body.trim() ?? "";
    const cards = parseReleaseNotesCards(body, notes.title);

    return (
        <Stack gap="md">
            {(notes.publishedAt !== undefined || notes.htmlUrl !== undefined) && (
                <Group gap="xs">
                    {notes.publishedAt !== undefined && <LocalizedText size="xs" c="dimmed" i18nKey="release.notes.modal.published.at" variables={{ date: formatDate(notes.publishedAt) }} />}
                    {notes.htmlUrl !== undefined && (
                        <Anchor size="xs" component="button" type="button" onClick={() => openUrl(notes.htmlUrl!)}>
                            {t("release.notes.modal.open.on.github")}
                        </Anchor>
                    )}
                </Group>
            )}

            {body.length === 0 ? (
                <LocalizedText size="sm" c="dimmed" i18nKey="release.notes.modal.empty" />
            ) : (
                <Box className="release-notes-cards">
                    <Stack gap="xs">
                        {cards.map((card, cardIndex) => (
                            <Box key={cardIndex} className="release-notes-card">
                                <Group gap="xs" justify="space-between" align="baseline" wrap="nowrap" className="release-notes-card__header">
                                    <Group gap="xs" align="baseline" wrap="nowrap" className="release-notes-card__title-group">
                                        <Text size="sm" fw={700} className="release-notes-card__title">
                                            {card.title}
                                        </Text>
                                        {card.fullChangelogUrl !== undefined && renderExternalLink(card.fullChangelogUrl, "Full changelog", "release-notes-card__header-link")}
                                    </Group>
                                    {card.publishedAt !== undefined && (
                                        <Text size="xs" c="dimmed" className="release-notes-card__published-at">
                                            {card.publishedAt}
                                        </Text>
                                    )}
                                </Group>
                                <Stack gap={4}>{card.lines.map(renderReleaseNotesLine)}</Stack>
                            </Box>
                        ))}
                    </Stack>
                </Box>
            )}
        </Stack>
    );
}
