import '@mantine/core/styles.css'
import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import App from './App'
import { useSystemAppearance } from './hooks/useSystemAppearance'

function Root(): React.JSX.Element {
  const appearance = useSystemAppearance()

  return (
    <MantineProvider forceColorScheme={appearance.colorScheme}>
      <App />
    </MantineProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
