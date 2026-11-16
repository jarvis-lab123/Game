import { useEffect } from 'react'
import { useRoute } from './router'
import { useSettings, useTheme } from './settings'
import { Shell } from './Shell'
import { db } from '../db/db'
import { startAutoSync } from '../db/autosync'
import { setDueBadge } from '../platform'
import { Today } from './screens/Today'
import { Session } from './screens/Session'
import { SessionSetup, type StudyMode } from './screens/SessionSetup'
import { Decks } from './screens/Decks'
import { DeckDetail } from './screens/DeckDetail'
import { ImportScreen } from './screens/ImportScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { Practice } from './screens/Practice'
import { ProbeTest } from './screens/ProbeTest'
import { StatsScreen } from './screens/StatsScreen'

export function App() {
  const route = useRoute()
  const settings = useSettings()
  useTheme(settings.theme)

  useEffect(() => startAutoSync(db), [])
  useEffect(() => {
    void db.cards.toArray().then((cs) => setDueBadge(cs.filter((c) => c.stage === 'review' && !c.suspended && c.due <= Date.now()).length))
  }, [route.path])

  const q = route.query
  if (route.parts[0] === 'lernen') {
    if (!q.get('go')) return <SessionSetup deckId={q.get('deck') ?? undefined} />
    return (
      <Session
        key={q.toString()}
        deckId={q.get('deck') ?? undefined}
        minutes={Number(q.get('min')) || settings.dailyMinutesGoal}
        mode={(q.get('mode') as StudyMode) || 'type'}
        drill={q.get('drill') === '1'}
      />
    )
  }
  if (route.parts[0] === 'probetest' && q.get('deck')) return <ProbeTest key={q.toString()} deckId={q.get('deck')!} />

  let screen
  switch (route.parts[0]) {
    case 'decks':
      screen = <Decks />
      break
    case 'deck':
      screen = <DeckDetail id={route.parts[1]} />
      break
    case 'import':
      screen = <ImportScreen deckId={q.get('deck') ?? undefined} />
      break
    case 'einstellungen':
      screen = <SettingsScreen />
      break
    case 'ueben':
      screen = <Practice tab={(q.get('tab') as 'fehlerheft' | 'probetest' | 'werkstatt') ?? undefined} />
      break
    case 'statistik':
      screen = <StatsScreen />
      break
    default:
      screen = <Today />
  }
  return <Shell path={route.path}>{screen}</Shell>
}
