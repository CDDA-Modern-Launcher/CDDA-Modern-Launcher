import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Group, Paper, Progress, Stack, Text } from '@mantine/core'

type UpdateState = Awaited<ReturnType<typeof window.api.updater.getState>>

function isVisibleState(state: UpdateState): boolean {
  return state.status !== 'idle' && state.status !== 'not-available' && state.status !== 'skipped'
}

function getTitle(state: UpdateState): string {
  switch (state.status) {
    case 'checking':
      return 'Checking for updates'
    case 'available':
      return `Update ${state.version} found`
    case 'downloading':
      return `Downloading update ${state.version}`
    case 'downloaded':
      return `Update ${state.version} is ready`
    case 'error':
      return 'Update check failed'
    default:
      return ''
  }
}

function getDescription(state: UpdateState): string {
  switch (state.status) {
    case 'checking':
      return 'Looking for a newer launcher version.'
    case 'available':
      return 'The update will be downloaded automatically.'
    case 'downloading':
      return `${state.percent}% downloaded.`
    case 'downloaded':
      return 'Restart the app to install it now, or continue working and install later.'
    case 'error':
      return state.message
    default:
      return ''
  }
}

export function UpdateFloatingCard(): React.JSX.Element | null {
  const [state, setState] = useState<UpdateState>({ status: 'idle' })

  useEffect(() => {
    let mounted = true

    window.api.updater.getState().then((initialState) => {
      if (mounted) {
        setState(initialState)
      }
    })

    const unsubscribe = window.api.updater.onStateChanged(setState)

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (state.status !== 'not-available' && state.status !== 'skipped') {
      return
    }

    const timer = window.setTimeout(() => {
      setState({ status: 'idle' })
    }, 1500)

    return () => window.clearTimeout(timer)
  }, [state])

  const title = useMemo(() => getTitle(state), [state])
  const description = useMemo(() => getDescription(state), [state])

  if (!isVisibleState(state)) {
    return null
  }

  return (
    <Paper
      withBorder
      shadow="lg"
      radius="md"
      p="md"
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 1000,
        width: 360
      }}
    >
      <Stack gap="sm">
        {state.status === 'error' ? (
          <Alert color="red" title={title} variant="light">
            {description}
          </Alert>
        ) : (
          <>
            <Text fw={600}>{title}</Text>
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          </>
        )}

        {state.status === 'downloading' && <Progress value={state.percent} animated />}

        {state.status === 'downloaded' && (
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" size="xs" onClick={() => window.api.updater.skipVersion(state.version)}>
              Skip {state.version}
            </Button>
            <Button variant="default" size="xs" onClick={() => window.api.updater.dismiss()}>
              Later
            </Button>
            <Button size="xs" onClick={() => window.api.updater.installNow()}>
              Restart now
            </Button>
          </Group>
        )}

        {state.status === 'error' && (
          <Group justify="flex-end">
            <Button variant="default" size="xs" onClick={() => window.api.updater.dismiss()}>
              Close
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  )
}
