import { Alert, Button, Card, Group, Loader, Stack, Text, Title } from "@mantine/core";
import React, { useEffect, useState } from "react";

import { REPOSITORY_CONFIG_FILE_NAME, RepositoryStatus } from "../../../shared/repository";
import { useLocalization } from "../localization/LocalizationContext";

export function RepositoryGate(): React.JSX.Element {
    const { t } = useLocalization();
    const [repository, setRepository] = useState<RepositoryStatus>({ status: "unconfigured" });
    const [isSelecting, setSelecting] = useState(false);

    useEffect(() => {
        let mounted = true;

        window.api.repository.getStatus().then((status) => {
            if (mounted) {
                setRepository(status);
            }
        });

        return () => {
            mounted = false;
        };
    }, []);

    const selectRepository = async (): Promise<void> => {
        setSelecting(true);

        try {
            const result = await window.api.repository.selectFolder();

            if (result.status === "selected") {
                setRepository(result.repository);
            }
        } finally {
            setSelecting(false);
        }
    };

    if (repository.status === "loading") {
        return <LoadingRepository path={repository.path} />;
    }

    if (repository.status === "ready") {
        return <ReadyRepository path={repository.path} createdAt={repository.config.createdAt} />;
    }

    return (
        <RepositorySetup
            repository={repository}
            isSelecting={isSelecting}
            onSelectRepository={() => {
                selectRepository().catch((error) => {
                    console.error("Failed to select repository", error);
                    setRepository({
                        status: "invalid",
                        path: repository.status === "invalid" ? repository.path : "",
                        message: t("repository.error.selectFailed")
                    });
                });
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
                    <Button loading={isSelecting} onClick={onSelectRepository} size="md">
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
            <Group gap="md" align="flex-start">
                <Loader size="sm" />
                <Stack gap={4}>
                    <Title order={2}>{t("repository.loading.title")}</Title>
                    <Text c="dimmed">{t("repository.loading.description", { fileName: REPOSITORY_CONFIG_FILE_NAME })}</Text>
                    <Text size="sm" c="dimmed">
                        {path}
                    </Text>
                </Stack>
            </Group>
        </Card>
    );
}

function ReadyRepository({ path, createdAt }: { path: string; createdAt: string }): React.JSX.Element {
    const { t } = useLocalization();

    return (
        <Card withBorder radius="lg" p="xl" className="repository-card">
            <Stack gap="lg">
                <Stack gap={4}>
                    <Text size="sm" c="dimmed" tt="uppercase" fw={700} className="eyebrow">
                        {t("repository.ready.eyebrow")}
                    </Text>
                    <Title order={1}>{t("repository.ready.title")}</Title>
                    <Text c="dimmed">{t("repository.ready.description")}</Text>
                </Stack>

                <Stack gap={4} className="repository-details">
                    <Text size="sm" c="dimmed">
                        {t("repository.ready.path")}
                    </Text>
                    <Text className="path-text">{path}</Text>
                    <Text size="sm" c="dimmed" mt="xs">
                        {t("repository.ready.created")}
                    </Text>
                    <Text>{createdAt}</Text>
                </Stack>
            </Stack>
        </Card>
    );
}
