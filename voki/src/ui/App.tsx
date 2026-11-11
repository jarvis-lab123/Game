import { useRoute } from './router'
import { useSettings, useTheme } from './settings'
import { Shell } from './Shell'
import { Today } from './screens/Today'
import { Session } from './screens/Session'
import { Decks } from './screens/Decks'
import { DeckDetail } from './screens/DeckDetail'
import { ImportScreen } from './screens/ImportScreen'
import { SettingsScreen } from './screens/SettingsScreen'

export function App() {
  const route = useRoute()
  const settings = useSettings()
  useTheme(settings.theme)

  if (route.parts[0] === 'lernen')
    return <Session key={route.query.toString()} deckId={route.query.get('deck') ?? undefined} extraMinutes={Number(route.query.get('plus') ?? 0)} />

  let screen
  switch (route.parts[0]) {
    case 'decks':
      screen = <Decks />
      break
    case 'deck':
      screen = <DeckDetail id={route.parts[1]} />
      break
    case 'import':
      screen = <ImportScreen deckId={route.query.get('deck') ?? undefined} />
      break
    case 'einstellungen':
      screen = <SettingsScreen />
      break
    default:
      screen = <Today />
  }
  return <Shell path={route.path}>{screen}</Shell>
}
