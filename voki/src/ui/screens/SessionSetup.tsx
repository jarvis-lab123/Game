import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { planDay, sessionCards } from '../../db/queries'
import { planGroups } from '../../lib/groups'
import { deckForecast } from '../../db/forecast'
import { daysToFinish } from '../../lib/forecast'
import { Button, cx } from '../components'
import { Flag, IconBack, IconPlay } from '../icons'
import { go } from '../router'
import { useSettings } from '../settings'
import { setFullscreen } from '../../platform'

export type StudyMode = 'type' | 'hand' | 'listen' | 'flip'
export const MODES: { value: StudyMode; label: string; hint: string }[] = [
  { value: 'type', label: 'Tippen', hint: 'Wie im Test: selbst schreiben, automatisch geprüft.' },
  { value: 'hand', label: 'Handschrift', hint: 'Mit Finger, Stift oder auf Papier schreiben, dann selbst vergleichen.' },
  { value: 'listen', label: 'Hören', hint: 'Du hörst das Wort und tippst die Bedeutung.' },
  { value: 'flip', label: 'Umdrehen', hint: 'Schnell: Karte umdrehen und selbst bewerten.' },
]
const TIMES = [5, 10, 15, 25, 40]

function Chip({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      onClick={onClick}
      className={cx(
        'min-h-11 rounded-xl px-4 text-[15px] font-medium ring-1 ring-inset transition-colors duration-150',
        active ? 'bg-accent text-on-accent ring-accent' : 'bg-surface text-fg ring-line hover:bg-surface-2',
      )}
    >
      {children}
    </button>
  )
}

export function SessionSetup({ deckId: initialDeck }: { deckId?: string }) {
  const settings = useSettings()
  const decks = useLiveQuery(() => db.decks.filter((d) => !d.archived).toArray(), [])
  const [minutes, setMinutes] = useState<number>(() => Number(localStorage.getItem('voki.minutes')) || 15)
  const [mode, setMode] = useState<StudyMode>(() => (localStorage.getItem('voki.mode') as StudyMode) || 'type')
  const [deck, setDeck] = useState(initialDeck ?? '')
  const preview = useLiveQuery(async () => {
    const now = new Date()
    const plan = await planDay(db, now, deck || undefined)
    const groups = planGroups(sessionCards(plan, now), minutes)
    const words = groups.reduce((s, g) => s + new Set(g.fresh.map((c) => c.noteId)).size, 0)
    const reviews = groups.reduce((s, g) => s + g.reviews.length + g.cram.length, 0)
    const all = plan.reviews + plan.news + plan.cram
    const fc = await deckForecast(db, deck || undefined)
    return { groups: groups.length, words, reviews, all, effort: fc.minutes, pace: fc.pace }
  }, [deck, minutes])

  useEffect(() => {
    if (!localStorage.getItem('voki.minutes')) setMinutes(settings.dailyMinutesGoal)
  }, [settings.dailyMinutesGoal])

  const start = () => {
    localStorage.setItem('voki.minutes', String(minutes))
    localStorage.setItem('voki.mode', mode)
    if (settings.autoFullscreen) void setFullscreen(true) // inside the click/Enter gesture
    go(`/lernen?go=1&min=${minutes}&mode=${mode}${deck ? `&deck=${deck}` : ''}&t=${Date.now()}`)
  }
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Enter' && !(e.target instanceof HTMLButtonElement) && preview && preview.groups > 0 && start()
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  return (
    <div className="mx-auto flex min-h-full max-w-[640px] flex-col px-4 pb-10 pt-6 desk:pt-14">
      <button onClick={() => go('/')} className="-ml-2 mb-4 inline-flex min-h-11 items-center gap-1 self-start rounded-lg px-2 text-sm text-muted hover:text-fg">
        <IconBack width={16} height={16} /> Heute
      </button>
      <h1 className="text-[28px] font-semibold tracking-tight">Wie viel Zeit hast du?</h1>
      <p className="mt-1 text-[15px] text-muted">Voki teilt die Wörter in kleine Gruppen ein, die in deine Zeit passen.</p>

      <div role="radiogroup" aria-label="Zeit" className="mt-6 flex flex-wrap gap-2">
        {TIMES.map((t) => (
          <Chip key={t} active={minutes === t} onClick={() => setMinutes(t)} label={`${t} Minuten`}>
            {t} Min
          </Chip>
        ))}
      </div>

      <h2 className="mt-8 text-[13px] font-semibold uppercase tracking-wide text-muted">Wie willst du üben?</h2>
      <div role="radiogroup" aria-label="Modus" className="mt-3 flex flex-wrap gap-2">
        {MODES.map((m) => (
          <Chip key={m.value} active={mode === m.value} onClick={() => setMode(m.value)}>
            {m.label}
          </Chip>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">{MODES.find((m) => m.value === mode)?.hint}</p>

      {decks && decks.length > 1 && (
        <>
          <h2 className="mt-8 text-[13px] font-semibold uppercase tracking-wide text-muted">Was?</h2>
          <div role="radiogroup" aria-label="Deck" className="mt-3 flex flex-wrap gap-2">
            <Chip active={!deck} onClick={() => setDeck('')}>Alles gemischt</Chip>
            {decks.map((d) => (
              <Chip key={d.id} active={deck === d.id} onClick={() => setDeck(d.id)}>
                <span className="inline-flex items-center gap-2"><Flag lang={d.language} size={16} />{d.name}</span>
              </Chip>
            ))}
          </div>
        </>
      )}

      <div className="mt-auto pt-10">
        {preview && preview.effort > 0 && (
          <p className="mb-2 text-center text-[13px] text-muted tabular">
            Bis alles sitzt: ca. {preview.effort >= 60 ? `${Math.floor(preview.effort / 60)} h ${preview.effort % 60} min` : `${preview.effort} min`}
            {' '}· bei {minutes} Min/Tag ≈ {daysToFinish(preview.effort, minutes)} {daysToFinish(preview.effort, minutes) === 1 ? 'Tag' : 'Tage'}
            {preview.pace.samples >= 20 ? ` · dein Tempo ${Math.round(preview.pace.secPerAnswer)} s/Antwort` : ''}
          </p>
        )}
        {preview && (
          <p className="mb-3 text-center text-[15px] text-muted tabular" aria-live="polite">
            {preview.groups === 0
              ? 'Gerade nichts fällig. Morgen geht’s weiter.'
              : `${preview.groups} ${preview.groups === 1 ? 'Gruppe' : 'Gruppen'} · ${preview.words} neue Wörter · ${preview.reviews} Wiederholungen`}
          </p>
        )}
        <Button variant="primary" size="lg" className="w-full" disabled={!preview || preview.groups === 0} onClick={start} kbd="Enter">
          <IconPlay /> Los geht’s
        </Button>
      </div>
    </div>
  )
}
