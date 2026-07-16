import BrowserShell from './screens/BrowserShell'
import EmptyState from './screens/EmptyState'
import { useAppSelector } from './store'

/** Single-window screen switch (spec decision 7): empty state ⇄ browser shell. */
export function App() {
  const screen = useAppSelector((state) => state.app.screen)
  return screen === 'shell' ? <BrowserShell /> : <EmptyState />
}

export default App
