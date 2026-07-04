import { RepositoryGate } from './components/RepositoryGate'
import { UpdateFloatingCard } from './components/UpdateFloatingCard'

function App(): React.JSX.Element {
  return (
    <>
      <UpdateFloatingCard />

      <main className="app-shell">
        <RepositoryGate />
      </main>
    </>
  )
}

export default App
