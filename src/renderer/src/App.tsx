import { Button, Group, Stack, Text, Title } from '@mantine/core'
import Versions from './components/Versions'
import { UpdateFloatingCard } from './components/UpdateFloatingCard'
import electronLogo from './assets/electron.svg'

function App(): React.JSX.Element {
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')
  const showMockUpdate = (): void => {
    window.api.updater.showMockDownloadedUpdate().catch((error) => {
      console.error('Failed to show mock update', error)
    })
  }

  return (
    <>
      <UpdateFloatingCard />

      <Stack align="center" gap="md" p="xl">
        <img alt="logo" className="logo" src={electronLogo} />
        <Text c="dimmed">Powered by electron-vite</Text>
        <Title order={1}>CDDA Launcher</Title>
        <Text>
          TEST app with <span className="react">React</span>
          &nbsp;and <span className="ts">TypeScript</span>
        </Text>
        <Text size="sm" c="dimmed">
          Please try pressing <code>F12</code> to open the devTool
        </Text>

        <Group>
          <Button component="a" href="https://electron-vite.org/" target="_blank" rel="noreferrer" variant="default">
            Documentation
          </Button>
          <Button variant="default" onClick={ipcHandle}>
            Send IPC
          </Button>
          <Button onClick={showMockUpdate}>Show test update</Button>
        </Group>

        <Versions />
      </Stack>
    </>
  )
}

export default App
