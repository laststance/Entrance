import BrowserShell from './screens/BrowserShell'
import EmptyState from './screens/EmptyState'
import LibraryScreen from './screens/LibraryScreen'
import ReplayScreen from './screens/ReplayScreen'

import { useAppSelector } from './store'

/** Single-window screen switch (spec decision 7): library ⇄ 1f empty ⇄ recorder shell ⇄ replay. */
export function App() {
  const screen = useAppSelector((state) => state.app.screen)
  if (screen === 'shell') return <BrowserShell />
  if (screen === 'library') return <LibraryScreen />
  if (screen === 'replay') return <ReplayScreen />
  return <EmptyState />
}

export default App
