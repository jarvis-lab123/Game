import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { planDay, sessionCards } from '../../db/queries'
import { planGroups } from '../../lib/groups'
import { deckForecast } from '../../db/forecast'
import { daysToFinish } from '../../lib/forecast'
import { crunchPlan, type CrunchPlan } from '../../lib/crunch'
import { Button, Toggle, cx } from '../components'
import { Flag, IconBack, IconCheck, IconFlame, IconPlay } from '../icons'
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

/** Short, research-based crunch tips (spacing, retrieval practice, test rehearsal, sleep). */
export const CRUNCH_TIPS = [
  'Mehrere kurze Sessions über den Tag verteilt',
  'Abfragen statt Durchlesen – jedes Wort 2× richtig',
  'Am Vorabend: Probetest statt Wiederholen',
  'Genug schlafen – Schlaf festigt Vokabeln',
]

const whenTest = (d: number) => (d === 0 ? 'heute' : d === 1 ? 'morgen' : `in ${d} Tagen`)
export const sessionsText = (p: Pick<CrunchPlan, 'sessionsPerDay' | 'sessionMinutes'>) =>
  `${p.sessionsPerDay} ${p.sessionsPerDay === 1 ? 'Session' : 'Sessions'} à ${p.sessionMinutes} Min`

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
  const [useCrunch, setUseCrunch] = useState(true)
  const preview = useLiveQuery(async () => {
    const now = new Date()
    const plan = await planDay(db, now, deck || undefined)
    const fc = await deckForecast(db, deck || undefined)
    // Not-Modus: the chosen deck, or the nearest exam when everything is mixed
    const examDeck = deck ? plan.decks.find((d) => d.exam) : plan.decks.filter((d) => d.exam).sort((a, b) => a.exam!.days - b.exam!.days)[0]
    let crunch: (CrunchPlan & { days: number; deckName: string }) | null = null
    if (examDeck?.exam) {
      const need = deck ? fc.minutes : (await deckForecast(db, examDeck.deck.id)).minutes
      const p = crunchPlan({ days: examDeck.exam.days, unintroduced: examDeck.unintroduced, minutesNeeded: need, dailyGoal: settings.dailyMinutesGoal })
      if (p.active) crunch = { ...p, days: examDeck.exam.days, deckName: examDeck.deck.name }
    }
    const groups = planGroups(sessionCards(plan, now), minutes, { crunch: !!crunch && useCrunch })
    const words = groups.reduce((s, g) => s + new Set(g.fresh.map((c) => c.noteId)).size, 0)
    const reviews = groups.reduce((s, g) => s + g.reviews.length + g.cram.length, 0)
    const all = plan.reviews + plan.news + plan.cram
    return { groups: groups.length, words, reviews, all, effort: fc.minutes, pace: fc.pace, crunch, deck }
  }, [deck, minutes, settings.dailyMinutesGoal, useCrunch])
  const crunch = preview?.crunch ?? null
  const crunchOn = !!crunch && useCrunch
  const times = crunch && !TIMES.includes(crunch.sessionMinutes) ? [...TIMES, crunch.sessionMinutes].sort((a, b) => a - b) : TIMES

  // preselect the crunch session length once per deck (the learner can still change it)
  const preselected = useRef('')
  useEffect(() => {
    if (!crunch || !preview || preview.deck !== deck) return
    const key = `${deck}:${crunch.sessionMinutes}`
    if (preselected.current === key) return
    preselected.current = key
    setMinutes(crunch.sessionMinutes)
  }, [crunch, deck, preview])

  useEffect(() => {
    if (!localStorage.getItem('voki.minutes')) setMinutes(settings.dailyMinutesGoal)
  }, [settings.dailyMinutesGoal])

  const start = () => {
    if (!crunchOn) localStorage.setItem('voki.minutes', String(minutes)) // crunch length isn't the everyday default
    localStorage.setItem('voki.mode', mode)
    if (settings.autoFullscreen) void setFullscreen(true) // inside the click/Enter gesture
    go(`/lernen?go=1&min=${minutes}&mode=${mode}${deck ? `&deck=${deck}` : ''}${crunchOn ? '&crunch=1' : ''}&t=${Date.now()}`)
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

      {crunch && <CrunchCard plan={crunch} on={useCrunch} onToggle={setUseCrunch} />}

      <div role="radiogroup" aria-label="Zeit" className="mt-6 flex flex-wrap gap-2">
        {times.map((t) => (
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
            {!crunchOn && <>{' '}· bei {minutes} Min/Tag ≈ {daysToFinish(preview.effort, minutes)} {daysToFinish(preview.effort, minutes) === 1 ? 'Tag' : 'Tage'}</>}
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

function CrunchCard({ plan, on, onToggle }: { plan: CrunchPlan & { days: number; deckName: string }; on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <section className="mt-6 rounded-[22px] bg-surface p-5 shadow-card ring-1 ring-inset ring-warn/30 desk:p-6" aria-labelledby="crunch-title">
      <div className="flex items-start gap-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-warn-soft text-warn" aria-hidden>
          <IconFlame width={20} height={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="crunch-title" className="text-[17px] font-semibold leading-snug">Not-Modus: Test {whenTest(plan.days)}</h2>
          <p className="mt-0.5 text-[15px] leading-snug text-muted">{plan.deckName} · {plan.reason}</p>
          <p className="mt-2.5 inline-flex rounded-full bg-warn-soft px-3 py-1 text-[13px] font-semibold text-warn tabular">Plan: {sessionsText(plan)} heute</p>
        </div>
      </div>
      <div className="mt-4 border-t border-line pt-3">
        <Toggle checked={on} onChange={onToggle} label="Not-Modus nutzen" description="Mit Lückentext, Schreiben zuerst, jedes Wort 2× richtig." />
      </div>
      {on && (
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3.5">
          {CRUNCH_TIPS.map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-[14px] leading-snug text-muted">
              <IconCheck width={16} height={16} className="mt-[1px] shrink-0 text-warn" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
