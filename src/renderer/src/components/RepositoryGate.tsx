import { useEffect, useState } from 'react'
import { Alert, Button, Card, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { RepositoryStatus } from '../../../shared/repository'

export function RepositoryGate(): React.JSX.Element {
  const [repository, setRepository] = useState<RepositoryStatus>({ status: 'unconfigured' })
  const [isSelecting, setSelecting] = useState(false)

  useEffect(() => {
    let mounted = true

    window.api.repository.getStatus().then((status) => {
      if (mounted) {
        setRepository(status)
      }
    })

    return () => {
      mounted = false
    }
  }, [])

  const selectRepository = async (): Promise<void> => {
    setSelecting(true)

    try {
      const result = await window.api.repository.selectFolder()

      if (result.status === 'selected') {
        setRepository(result.repository)
      }
    } finally {
      setSelecting(false)
    }
  }

  if (repository.status === 'loading') {
    return <LoadingRepository path={repository.path} />
  }

  if (repository.status === 'ready') {
    return <ReadyRepository path={repository.path} createdAt={repository.config.createdAt} />
  }

  return (
    <RepositorySetup
      repository={repository}
      isSelecting={isSelecting}
      onSelectRepository={() => {
        selectRepository().catch((error) => {
          console.error('Failed to select repository', error)
          setRepository({
            status: 'invalid',
            path: repository.status === 'invalid' ? repository.path : '',
            message: 'Cannot select repository folder right now.'
          })
        })
      }}
    />
  )
}

type RepositorySetupProps = {
  repository: Extract<RepositoryStatus, { status: 'unconfigured' | 'invalid' }>
  isSelecting: boolean
  onSelectRepository: () => void
}

function RepositorySetup({
  repository,
  isSelecting,
  onSelectRepository
}: RepositorySetupProps): React.JSX.Element {
  return (
    <Card withBorder radius="lg" p="xl" className="repository-card">
      <Stack gap="lg">
        <Stack gap={4}>
          <Text size="sm" c="dimmed" tt="uppercase" fw={700} className="eyebrow">
            Local repository
          </Text>
          <Title order={1}>CDDA Launcher</Title>
          <Text c="dimmed">
            Select a folder where the launcher will keep game builds, mods, soundpacks, tilesets and
            its local repository metadata.
          </Text>
        </Stack>

        {repository.status === 'invalid' && (
          <Alert color="red" title="Repository folder is not valid" variant="light">
            <Stack gap={6}>
              {repository.path.length > 0 && <Text size="sm">{repository.path}</Text>}
              <Text size="sm">{repository.message}</Text>
            </Stack>
          </Alert>
        )}

        <Stack gap="xs" className="repository-rules">
          <Text size="sm">An empty folder will be initialized automatically.</Text>
          <Text size="sm">
            A non-empty folder is accepted only when it already contains a valid{' '}
            <code>cdda.launcher.config.jsonc</code>.
          </Text>
          <Text size="sm">
            The selected path is stored in the launcher profile and survives app updates.
          </Text>
        </Stack>

        <Group justify="flex-end">
          <Button loading={isSelecting} onClick={onSelectRepository} size="md">
            Select repository folder
          </Button>
        </Group>
      </Stack>
    </Card>
  )
}

function LoadingRepository({ path }: { path: string }): React.JSX.Element {
  return (
    <Card withBorder radius="lg" p="xl" className="repository-card">
      <Group gap="md" align="flex-start">
        <Loader size="sm" />
        <Stack gap={4}>
          <Title order={2}>Loading repository</Title>
          <Text c="dimmed">Reading and validating cdda.launcher.config.jsonc.</Text>
          <Text size="sm" c="dimmed">
            {path}
          </Text>
        </Stack>
      </Group>
    </Card>
  )
}

function ReadyRepository({
  path,
  createdAt
}: {
  path: string
  createdAt: string
}): React.JSX.Element {
  return (
    <Card withBorder radius="lg" p="xl" className="repository-card">
      <Stack gap="lg">
        <Stack gap={4}>
          <Text size="sm" c="dimmed" tt="uppercase" fw={700} className="eyebrow">
            Repository ready
          </Text>
          <Title order={1}>CDDA Launcher</Title>
          <Text c="dimmed">
            Local repository has been validated. Version discovery can be connected next.
          </Text>
        </Stack>

        <Stack gap={4} className="repository-details">
          <Text size="sm" c="dimmed">
            Path
          </Text>
          <Text className="path-text">{path}</Text>
          <Text size="sm" c="dimmed" mt="xs">
            Created
          </Text>
          <Text>{createdAt}</Text>
        </Stack>
      </Stack>
    </Card>
  )
}
