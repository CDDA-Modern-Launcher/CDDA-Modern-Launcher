import { Alert, Badge, Button, Card, Divider, Group, Loader, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import React from "react";

import { findGameChannel, getEffectiveGameChannels, getGameChannelRepositoryUrl } from "../../../shared/gameChannels";
import { REPOSITORY_CONFIG_FILE_NAME, RepositoryStatus } from "../../../shared/repository";
import { useLocalization } from "../localization/LocalizationContext";

export type RepositoryGateProps = {
    repository: RepositoryStatus;
    isSelecting: boolean;
    onSelectRepository: () => void;
};

export function RepositoryGate({ repository, isSelecting, onSelectRepository }: RepositoryGateProps): React.JSX.Element {
    if (repository.status === "loading") {
        return <LoadingRepository path={repository.path} />;
    }

    if (repository.status === "ready") {
        return <ReadyRepository repository={repository} />;
    }

    return (
        <RepositorySetup
            repository={repository}
            isSelecting={isSelecting}
            onSelectRepository={() => {
                try {
                    onSelectRepository();
                } catch (error) {
                    console.error("Failed to select repository", error);
                }
            }}
        />
    );
}

type RepositorySetupProps = {
    repository: Extract<RepositoryStatus, { status: "unconfigured" | "invalid" }>;
    isSelecting: boolean;
    onSelectRepository: () => void;
};

function RepositorySetup({ repository, isSelecting, onSelectRepository }: RepositorySetupProps): React.JSX.Element {
    const { t } = useLocalization();

    return (
        <Card withBorder radius="lg" p="xl" className="repository-card">
            <Stack gap="lg">
                <Stack gap={4}>
                    <Text size="sm" c="dimmed" tt="uppercase" fw={700} className="eyebrow">
                        {t("repository.setup.eyebrow")}
                    </Text>
                    <Title order={1}>{t("repository.setup.title")}</Title>
                    <Text c="dimmed">{t("repository.setup.description")}</Text>
                </Stack>

                {repository.status === "invalid" && (
                    <Alert color="red" title={t("repository.setup.invalidTitle")} variant="light">
                        <Stack gap={6}>
                            {repository.path.length > 0 && <Text size="sm">{repository.path}</Text>}
                            <Text size="sm">{repository.message}</Text>
                        </Stack>
                    </Alert>
                )}

                <Stack gap="xs" className="repository-rules">
                    <Text size="sm">{t("repository.setup.rule.emptyFolder")}</Text>
                    <Text size="sm">
                        {t("repository.setup.rule.nonEmptyFolder.prefix")} <code>{REPOSITORY_CONFIG_FILE_NAME}</code>.
                    </Text>
                    <Text size="sm">{t("repository.setup.rule.persistedPath")}</Text>
                </Stack>

                <Group justify="flex-end">
                    <Button loading={isSelecting} onClick={onSelectRepository}>
                        {t("repository.setup.selectButton")}
                    </Button>
                </Group>
            </Stack>
        </Card>
    );
}

function LoadingRepository({ path }: { path: string }): React.JSX.Element {
    const { t } = useLocalization();

    return (
        <Card withBorder radius="lg" p="xl" className="repository-card">
            <Group gap="lg" wrap="nowrap">
                <Loader />
                <Stack gap={2}>
                    <Title order={2}>{t("repository.loading.title")}</Title>
                    <Text c="dimmed">{t("repository.loading.description", { fileName: REPOSITORY_CONFIG_FILE_NAME })}</Text>
                    <Text size="sm" className="path-text">
                        {path}
                    </Text>
                </Stack>
            </Group>
        </Card>
    );
}

function ReadyRepository({ repository }: { repository: Extract<RepositoryStatus, { status: "ready" }> }): React.JSX.Element {
    const { t } = useLocalization();
    const channels = getEffectiveGameChannels(repository.config.customChannels);
    const selectedChannel = findGameChannel(channels, repository.config.selectedChannelId);

    return (
        <Stack className="home-dashboard" gap="lg">
            <Card withBorder radius="lg" p="xl" className="repository-card home-hero-card">
                <Stack gap="lg">
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Stack gap={4}>
                            <Text size="sm" c="dimmed" tt="uppercase" fw={700} className="eyebrow">
                                {t("home.eyebrow")}
                            </Text>
                            <Title order={1}>{selectedChannel.gameName}</Title>
                            <Group gap="xs">
                                <Badge variant="light">{selectedChannel.channelName}</Badge>
                                <Badge
                                    component="button"
                                    variant="outline"
                                    className="home-repository-badge"
                                    onClick={() => {
                                        void window.api.shell.openExternal(getGameChannelRepositoryUrl(selectedChannel));
                                    }}
                                >
                                    {selectedChannel.githubOwner}/{selectedChannel.githubRepo}
                                </Badge>
                            </Group>
                        </Stack>
                        <Badge color="gray" variant="light" size="lg">
                            {t("home.status.notInstalled")}
                        </Badge>
                    </Group>

                    <Text c="dimmed">{t("home.description")}</Text>

                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <Button size="md" disabled>
                            {t("home.action.play")}
                        </Button>
                        <Button size="md" variant="light" disabled>
                            {t("home.action.continue")}
                        </Button>
                    </SimpleGrid>

                    <Alert variant="light" color="blue" title={t("home.install.title")}>
                        <Stack gap="sm">
                            <Text size="sm">{t("home.install.description")}</Text>
                            <Group gap="xs">
                                <Button size="xs" disabled>
                                    {t("home.action.install")}
                                </Button>
                                <Button size="xs" variant="subtle" disabled>
                                    {t("home.action.openReleases")}
                                </Button>
                            </Group>
                        </Stack>
                    </Alert>
                </Stack>
            </Card>

            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md" className="home-secondary-grid">
                <HomeInfoCard title={t("home.card.installation.title")} description={t("home.card.installation.description")} value={t("home.status.notInstalled")} />
                <HomeInfoCard title={t("home.card.world.title")} description={t("home.card.world.description")} value={t("home.status.unavailable")} />
                <HomeInfoCard title={t("home.card.backups.title")} description={t("home.card.backups.description")} value={t("home.status.uiOnly")} />
            </SimpleGrid>

            <Card withBorder radius="lg" p="md" className="repository-card repository-details">
                <Stack gap="xs">
                    <Group justify="space-between" wrap="nowrap">
                        <Text size="sm" c="dimmed">
                            {t("repository.ready.path")}
                        </Text>
                        <Text size="sm" className="path-text">
                            {repository.path}
                        </Text>
                    </Group>
                    <Divider />
                    <Group justify="space-between" wrap="nowrap">
                        <Text size="sm" c="dimmed">
                            {t("repository.ready.created")}
                        </Text>
                        <Text size="sm">{repository.config.createdAt}</Text>
                    </Group>
                </Stack>
            </Card>
        </Stack>
    );
}

function HomeInfoCard({ title, description, value }: { title: string; description: string; value: string }): React.JSX.Element {
    return (
        <Card withBorder radius="lg" p="md" className="home-info-card">
            <Stack gap="xs">
                <Text fw={700}>{title}</Text>
                <Text size="sm" c="dimmed">
                    {description}
                </Text>
                <Text size="sm">{value}</Text>
            </Stack>
        </Card>
    );
}
