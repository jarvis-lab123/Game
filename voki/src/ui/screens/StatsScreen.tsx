import { useLayoutEffect, useMemo, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db } from '../../db/db'
import { loadSettings, startOfDay } from '../../db/queries'
import { masteryInfo, emptyCounts } from '../../db/mastery'
import { allDeckForecasts } from '../../db/forecast'
import { daysToFinish, type Pace } from '../../lib/forecast'
import type { Mastery } from '../../lib/mastery'
import { accuracy, activityByDay, dayKey, dueForecast, GRADED_MODES, learnedWords, type Accuracy, type DayCount } from '../../lib/stats'
import type { Deck, ReviewLog } from '../../lib/types'
import { Button, Empty, PageHeader, Panel, Ring, SectionTitle, pct } from '../components'
import { Flag } from '../icons'
import { MasteryBar } from '../MasteryBar'
import { StreakCard } from '../StreakCard'
import { go } from '../router'
import { byDaypart, gradeStats, hardestWords, minutesByDay, modeBreakdown, weekCompare, type DaypartRow, type GradeStats, type HardWord, type ModeRow } from '../../lib/morestats'
import { gradeTone } from '../../lib/papertest'
import { GradeChip, loadDeckBlocks, type DeckBlocks } from './BlockLearn'
import type { Note } from '../../lib/types'

const WEEKS = 20
const FORECAST_DAYS = 30
const ACC_DAYS = 14
const DAY = 86400000

const fmtNum = new Intl.NumberFormat('de-CH')
const fmtShort = new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'numeric' })
const fmtLong = new Intl.DateTimeFormat('de-CH', { weekday: 'short', day: 'numeric', month: 'long' })
const fmtMonth = new Intl.DateTimeFormat('de-CH', { month: 'short' })

/** "YYYY-MM-DD" → local Date */
function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "45 min", "2 h 10 min", "3 h" — longer spans rounded to 5 min. */
function fmtDuration(min: number): string {
  if (min < 60) return `${Math.max(1, Math.round(min))} min`
  const r = Math.round(min / 5) * 5
  const h = Math.floor(r / 60)
  const m = r % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

interface AccDay { date: string; label: string; value: number | null; n: number; correct: number }

/** Share correct per local day (graded answers only); null on days without answers. */
function accuracyByDay(logs: ReviewLog[], days: number, now: Date): AccDay[] {
  const keys = Array.from({ length: days }, (_, i) => dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1) + i)))
  const t = new Map(keys.map((k) => [k, [0, 0]]))
  for (const l of logs) {
    if (!GRADED_MODES.includes(l.mode)) continue
    const v = t.get(dayKey(new Date(l.timestamp)))
    if (!v) continue
    v[1]++
    if (l.correct) v[0]++
  }
  return keys.map((date) => {
    const [c, n] = t.get(date)!
    return { date, label: fmtShort.format(parseDay(date)), value: n ? Math.round((c / n) * 100) : null, n, correct: c }
  })
}

async function loadStats() {
  const now = new Date()
  const [decks, cards, logs, settings, mastery, fc, tests, notes] = await Promise.all([
    db.decks.toArray(),
    db.cards.toArray(),
    db.logs.toArray(),
    loadSettings(db),
    masteryInfo(db, undefined, now),
    allDeckForecasts(db),
    db.tests.toArray(),
    db.notes.toArray(),
  ])
  const noteById = new Map(notes.map((n) => [n.id, n]))
  const noteOfCard = new Map(cards.map((c) => [c.id, c.noteId]))
  const dirById = new Map(cards.map((c) => [c.id, c.direction]))
  const dirOf = (id: string) => dirById.get(id)
  const since = new Date(startOfDay(now) - 29 * DAY).toISOString()
  const recent = logs.filter((l) => l.timestamp >= since)

  // heatmap: WEEKS columns, Monday first; the last column is the current week
  const weekday = (now.getDay() + 6) % 7 // Mon = 0
  const heatDays = (WEEKS - 1) * 7 + weekday + 1
  const activeDecks = decks.filter((d) => !d.archived).sort((a, b) => a.name.localeCompare(b.name, 'de'))
  const withWords = activeDecks.filter((d) => mastery.byDeck.has(d.id))
  const time14 = minutesByDay(logs, 14, now)
  const blocks = (await Promise.all(withWords.map(loadDeckBlocks))).filter((b) => b.blocks.length > 0)
  const deckById = new Map(decks.map((d) => [d.id, d]))
  return {
    today: { answers: time14[13].answers, minutes: time14[13].minutes },
    time14,
    week: weekCompare(logs, now),
    grades: gradeStats(tests),
    blocks,
    modes: modeBreakdown(recent),
    dayparts: byDaypart(recent),
    hard: hardestWords(recent, (id) => noteOfCard.get(id), 15).map((w) => ({ ...w, note: noteById.get(w.noteId) })).filter((w): w is HardWord & { note: Note } => !!w.note).map((w) => ({ ...w, deck: deckById.get(w.note.deckId) })),
    now,
    totalLogs: logs.length,
    learned: learnedWords(cards.filter((c) => !c.suspended)),
    acc30: accuracy(recent, dirOf),
    activity: activityByDay(logs, heatDays, now),
    forecast: dueForecast(cards.filter((c) => activeDecks.some((d) => d.id === c.deckId)), FORECAST_DAYS, now),
    accDays: accuracyByDay(logs, ACC_DAYS, now),
    mastery: { counts: mastery.counts, decks: withWords.map((deck) => ({ deck, counts: mastery.byDeck.get(deck.id) ?? emptyCounts() })) },
    effort: { pace: fc.pace, total: fc.total, decks: withWords.map((deck) => ({ deck, ...(fc.byDeck.get(deck.id) ?? { answers: 0, minutes: 0 }) })) },
    dailyMinutes: settings.dailyMinutesGoal,
    perDeck: activeDecks
      .map((deck) => ({ deck, acc: accuracy(recent, dirOf, { deckId: deck.id }) }))
      .filter((r) => r.acc.n > 0)
      .sort((a, b) => b.acc.n - a.acc.n),
  }
}

export function StatsScreen() {
  const s = useLiveQuery(loadStats, [])
  if (!s) return <div className="h-40" aria-busy="true" />

  if (s.totalLogs === 0)
    return (
      <div>
        <PageHeader title="Statistik" />
        <Empty title="Noch keine Abfragen" action={<Button variant="primary" onClick={() => go('/lernen')}>Lernen starten</Button>}>
          Sobald du deine ersten Wörter geübt hast, siehst du hier deinen Fortschritt.
        </Empty>
      </div>
    )

  return (
    <div className="space-y-6">
      <PageHeader title="Statistik" />

      <div className="grid gap-3 desk:grid-cols-2 desk:gap-4">
        <StreakCard />
        <div className="grid grid-cols-2 gap-3">
          <Tile label="Gelernte Wörter" value={fmtNum.format(s.learned)} />
          <Tile label="Sitzen sicher" value={fmtNum.format(s.mastery.counts.sitzt)} />
          <Tile label="Abfragen gesamt" value={fmtNum.format(s.totalLogs)} />
          <Tile label="Trefferquote 30 T." value={pct(s.acc30.total)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 desk:grid-cols-4">
        <Tile label="Heute gelernt" value={`${fmtMin(s.today.minutes)} · ${fmtNum.format(s.today.answers)}×`} />
        <Tile label="Diese Woche" value={fmtMin(s.week.thisWeek.minutes)} />
        <Tile label="Ø Note" value={s.grades.average == null ? '–' : s.grades.average.toFixed(1)} tone={s.grades.average == null ? undefined : gradeTone(s.grades.average)} />
        <Tile label="Probetests" value={fmtNum.format(s.grades.count)} />
      </div>

      {(s.grades.count > 0 || s.blocks.some((b) => b.states.some((x) => x.grade != null))) && (
        <Panel>
          <SectionTitle>Noten</SectionTitle>
          <Grades g={s.grades} blocks={s.blocks} />
        </Panel>
      )}

      <Panel>
        <SectionTitle>Lernzeit</SectionTitle>
        <TimeChart data={s.time14} week={s.week} />
      </Panel>

      {s.mastery.decks.length > 0 && (
        <Panel>
          <SectionTitle>Wie gut kannst du's?</SectionTitle>
          <MasterySummary counts={s.mastery.counts} />
          <ul className="mt-2 divide-y divide-line">
            {s.mastery.decks.map((r) => <DeckMastery key={r.deck.id} deck={r.deck} counts={r.counts} />)}
          </ul>
        </Panel>
      )}

      {s.effort.decks.length > 0 && (
        <Panel>
          <SectionTitle>Noch zu lernen</SectionTitle>
          <Effort total={s.effort.total} decks={s.effort.decks} pace={s.effort.pace} daily={s.dailyMinutes} />
        </Panel>
      )}

      <Panel>
        <SectionTitle>Trefferquote der letzten 14 Tage</SectionTitle>
        <AccuracyTrend data={s.accDays} />
      </Panel>

      {s.modes.length > 0 && (
        <Panel>
          <SectionTitle>So lernst du</SectionTitle>
          <p className="-mt-1.5 mb-4 text-sm text-muted">Letzte 30 Tage</p>
          <Modes rows={s.modes} />
        </Panel>
      )}

      {s.dayparts.rows.some((r) => r.answers > 0) && (
        <Panel>
          <SectionTitle>Tageszeit</SectionTitle>
          <Dayparts rows={s.dayparts.rows} best={s.dayparts.best} />
        </Panel>
      )}

      {s.hard.length > 0 && (
        <Panel>
          <SectionTitle>Schwierigste Wörter</SectionTitle>
          <p className="-mt-1.5 mb-3 text-sm text-muted">Am häufigsten falsch · letzte 30 Tage · zählt jeden Fehler beim Lernen, im Satz und im Test</p>
          <HardList rows={s.hard} />
          <div className="mt-4 flex flex-col gap-2 desk:flex-row">
            <Button variant="primary" onClick={() => go('/knacknuss?src=fehler')}>Alle Fehler-Wörter nochmals machen</Button>
            <Button onClick={() => go('/knacknuss')}>Nur die schwierigsten 8</Button>
          </div>
        </Panel>
      )}

      <Panel>
        <SectionTitle>Aktivität</SectionTitle>
        <Heatmap days={s.activity} />
      </Panel>

      <Panel>
        <SectionTitle>Fällig in den nächsten 30 Tagen</SectionTitle>
        <Forecast data={s.forecast} />
      </Panel>

      {s.perDeck.length > 0 && (
        <Panel>
          <SectionTitle>Trefferquote</SectionTitle>
          <p className="-mt-1.5 mb-4 text-sm text-muted">Letzte 30 Tage</p>
          <ul className="divide-y divide-line">
            {s.perDeck.map((r) => <DeckAccuracy key={r.deck.id} deck={r.deck} acc={r.acc} />)}
          </ul>
        </Panel>
      )}
    </div>
  )
}

/* ---------- Mastery ---------- */

const sumCounts = (c: Record<Mastery, number>) => c.sitzt + c.lernt + c.wackelt + c.neu

function MasterySummary({ counts }: { counts: Record<Mastery, number> }) {
  const n = sumCounts(counts)
  return (
    <p className="text-sm text-muted">
      <span className="font-medium text-fg tabular">{fmtNum.format(counts.sitzt)}</span> von {fmtNum.format(n)} {n === 1 ? 'Wort sitzt' : 'Wörtern sitzen'}
      {counts.wackelt > 0 && <> · {fmtNum.format(counts.wackelt)} wackeln</>}
    </p>
  )
}

function DeckMastery({ deck, counts }: { deck: Deck; counts: Record<Mastery, number> }) {
  const n = sumCounts(counts)
  const share = n ? counts.sitzt / n : 0
  return (
    <li>
      <a href={`#/deck/${deck.id}`} className="-mx-2 flex items-center gap-4 rounded-2xl px-2 py-3.5 transition-colors duration-150 hover:bg-surface-2/60 active:bg-surface-2">
        <Ring value={share} size={52} stroke={6} tone="good" label={`${deck.name}: ${pct(share)} sitzen`}>
          <span className="text-[13px] font-semibold tabular">{Math.round(share * 100)}%</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="mb-2 flex items-center gap-2 font-medium">
            <Flag lang={deck.language} />
            <span className="truncate">{deck.name}</span>
            <span className="ml-auto shrink-0 text-xs font-normal text-muted tabular">{fmtNum.format(n)} Wörter</span>
          </p>
          <MasteryBar counts={counts} />
        </div>
      </a>
    </li>
  )
}

/* ---------- Effort ---------- */

function Effort({ total, decks, pace, daily }: { total: { minutes: number; answers: number }; decks: { deck: Deck; minutes: number; answers: number }[]; pace: Pace; daily: number }) {
  const days = daysToFinish(total.minutes, daily)
  return (
    <div>
      {total.minutes === 0 ? (
        <p className="text-[22px] font-bold tracking-tight">Alles sitzt</p>
      ) : (
        <>
          <p className="text-[28px] font-bold leading-tight tracking-tight tabular">ca. {fmtDuration(total.minutes)}</p>
          <p className="mt-0.5 text-[15px] text-muted tabular">
            bei {daily} Min/Tag ≈ {days} {days === 1 ? 'Tag' : 'Tage'} · rund {fmtNum.format(total.answers)} Antworten
          </p>
        </>
      )}

      {decks.length > 1 && (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {decks.map((d) => {
            const dd = daysToFinish(d.minutes, daily)
            return (
              <li key={d.deck.id} className="flex items-center gap-2.5 py-3 last:pb-0">
                <Flag lang={d.deck.language} />
                <a href={`#/deck/${d.deck.id}`} className="min-w-0 flex-1 truncate font-medium">{d.deck.name}</a>
                <span className="shrink-0 text-sm text-muted tabular">
                  {d.minutes === 0 ? 'sitzt' : <><span className="font-medium text-fg">{fmtDuration(d.minutes)}</span> · ≈ {dd} {dd === 1 ? 'Tag' : 'Tage'}</>}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-4 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px] text-muted">
        {pace.samples < 20 ? (
          'Noch zu wenig Daten – Schätzung mit Standardwerten'
        ) : (
          <>Dein Tempo: <span className="font-medium text-fg tabular">{Math.round(pace.secPerAnswer)} s</span> pro Antwort · <span className="font-medium text-fg tabular">{Math.round(pace.accuracy * 100)} %</span> richtig</>
        )}
      </p>
    </div>
  )
}

/* ---------- Accuracy trend ---------- */

function AccuracyTrend({ data }: { data: AccDay[] }) {
  const withData = data.filter((d) => d.value != null)
  if (withData.length === 0) return <p className="text-[15px] text-muted">In den letzten 14 Tagen hast du nichts abgefragt.</p>
  const n = withData.reduce((s, d) => s + d.n, 0)
  const c = withData.reduce((s, d) => s + d.correct, 0)
  const avg = Math.round((c / n) * 100)
  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        <span className="font-medium text-fg tabular">{avg} %</span> richtig · {fmtNum.format(n)} Antworten an {withData.length} {withData.length === 1 ? 'Tag' : 'Tagen'}
      </p>
      <div className="h-40" role="img" aria-label={`Trefferquote pro Tag, letzte 14 Tage, im Schnitt ${avg} Prozent.`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--line)' }} tick={{ fill: 'var(--muted)', fontSize: 11 }} interval={3} tickMargin={6} />
            <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v: number) => `${v}\u00a0%`} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} width={46} />
            <Tooltip cursor={{ stroke: 'var(--line)', strokeWidth: 1 }} content={<AccTip />} isAnimationActive={false} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--accent)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              connectNulls
              dot={{ r: 4, fill: 'var(--accent)', stroke: 'var(--surface)', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: 'var(--accent)', stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function AccTip({ active, payload }: { active?: boolean; payload?: readonly { payload: AccDay }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const day = parseDay(d.date)
  const today = startOfDay(new Date()) === day.getTime()
  return (
    <div className="rounded-lg bg-surface px-3 py-2 text-sm shadow-lg shadow-card">
      <p className="text-xs text-muted">{today ? 'Heute' : fmtLong.format(day)}</p>
      {d.value == null ? (
        <p className="font-medium text-muted">keine Antworten</p>
      ) : (
        <p className="tabular"><span className="font-semibold">{d.value} % richtig</span><span className="text-muted"> · {d.correct} von {d.n}</span></p>
      )}
    </div>
  )
}

const TONE_TEXT = { good: 'text-good', warn: 'text-warn', bad: 'text-bad' }

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="min-w-0 rounded-[22px] bg-surface px-4 py-3 shadow-card">
      <p className="truncate text-xs font-medium text-muted">{label}</p>
      <p className={`mt-0.5 truncate whitespace-nowrap text-[20px] font-semibold tracking-tight tabular ${tone ? TONE_TEXT[tone] : ''}`}>{value}</p>
    </div>
  )
}

/* ---------- Heatmap ---------- */

const CELL = 11
const GAP = 3
const LEVEL_OPACITY = [0, 0.35, 0.55, 0.78, 1]

function level(count: number, max: number): number {
  if (count <= 0) return 0
  if (max <= 4) return Math.min(4, count)
  return Math.min(4, Math.ceil((count / max) * 4))
}

function Heatmap({ days }: { days: DayCount[] }) {
  const scroller = useRef<HTMLDivElement>(null)
  // show the most recent weeks first on narrow screens
  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  const { weeks, max, total, activeDays } = useMemo(() => {
    const cols: (DayCount | null)[][] = []
    for (let i = 0; i < WEEKS * 7; i++) {
      const w = Math.floor(i / 7)
      ;(cols[w] ??= []).push(days[i] ?? null)
    }
    return {
      weeks: cols,
      max: days.reduce((m, d) => Math.max(m, d.count), 0),
      total: days.reduce((s, d) => s + d.count, 0),
      activeDays: days.filter((d) => d.count > 0).length,
    }
  }, [days])

  const months = weeks.map((w, i) => {
    const first = w[0] && parseDay(w[0].date)
    const prev = i > 0 && weeks[i - 1][0] ? parseDay(weeks[i - 1][0]!.date) : null
    return first && (!prev || prev.getMonth() !== first.getMonth()) ? fmtMonth.format(first).replace('.', '') : ''
  })
  const summary = `Aktivität der letzten ${WEEKS} Wochen: ${fmtNum.format(total)} Abfragen an ${activeDays} Tagen, höchstens ${max} an einem Tag.`
  const width = WEEKS * CELL + (WEEKS - 1) * GAP

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        <span className="font-medium text-fg">{fmtNum.format(total)}</span> Abfragen an {activeDays} {activeDays === 1 ? 'Tag' : 'Tagen'} · letzte {WEEKS} Wochen
      </p>
      <div ref={scroller} className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex w-max gap-1" role="img" aria-label={summary}>
          <div className="sticky left-0 z-10 grid shrink-0 bg-surface pr-1 pt-[18px] text-[10px] leading-none text-muted" style={{ gridTemplateRows: `repeat(7, ${CELL}px)`, rowGap: GAP }} aria-hidden>
            {['Mo', '', 'Mi', '', 'Fr', '', ''].map((l, i) => <span key={i} className="flex items-center">{l}</span>)}
          </div>
          <div style={{ width }}>
            <div className="relative mb-1.5 h-3 text-[10px] leading-none text-muted" aria-hidden>
              {months.map((m, i) => m && <span key={i} className="absolute whitespace-nowrap" style={{ left: i * (CELL + GAP) }}>{m}</span>)}
            </div>
            <div className="grid grid-flow-col" style={{ gridTemplateRows: `repeat(7, ${CELL}px)`, gridAutoColumns: `${CELL}px`, gap: GAP }}>
              {weeks.flat().map((d, i) =>
                d ? (
                  <span
                    key={d.date}
                    title={`${fmtLong.format(parseDay(d.date))}: ${d.count === 0 ? 'keine' : d.count} ${d.count === 1 ? 'Abfrage' : 'Abfragen'}`}
                    className="rounded-[3px]"
                    style={cellStyle(level(d.count, max))}
                  />
                ) : (
                  <span key={`f${i}`} />
                ),
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-muted" aria-hidden>
        <span className="mr-0.5">Weniger</span>
        {LEVEL_OPACITY.map((_, l) => <span key={l} className="rounded-[3px]" style={{ ...cellStyle(l), width: CELL, height: CELL }} />)}
        <span className="ml-0.5">Mehr</span>
      </div>
    </div>
  )
}

function cellStyle(l: number) {
  return l === 0
    ? { background: 'var(--surface-2)' }
    : { background: `color-mix(in srgb, var(--accent) ${LEVEL_OPACITY[l] * 100}%, var(--surface))` }
}

/* ---------- Forecast ---------- */

function Forecast({ data }: { data: DayCount[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  const peak = data.reduce((m, d) => (d.count > m.count ? d : m), data[0])
  const rows = data.map((d) => ({ ...d, label: fmtShort.format(parseDay(d.date)) }))
  if (total === 0) return <p className="text-[15px] text-muted">In den nächsten 30 Tagen ist nichts fällig.</p>
  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        <span className="font-medium text-fg">{fmtNum.format(total)}</span> Wiederholungen · heute {data[0].count}
        {peak.count > 0 && <> · Spitze {fmtShort.format(parseDay(peak.date))} ({peak.count})</>}
      </p>
      <div className="h-44" role="img" aria-label={`Fällige Wiederholungen pro Tag, insgesamt ${total} in 30 Tagen, heute ${data[0].count}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--line)' }} tick={{ fill: 'var(--muted)', fontSize: 11 }} interval={6} tickMargin={6} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} width={32} />
            <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ForecastTip />} isAnimationActive={false} />
            <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ForecastTip({ active, payload }: { active?: boolean; payload?: readonly { payload: DayCount }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const day = parseDay(d.date)
  const today = startOfDay(new Date()) === day.getTime()
  return (
    <div className="rounded-lg bg-surface px-3 py-2 text-sm shadow-lg shadow-card">
      <p className="text-xs text-muted">{today ? 'Heute' : fmtLong.format(day)}</p>
      <p className="font-semibold tabular">{d.count} fällig</p>
    </div>
  )
}

/* ---------- Accuracy per deck ---------- */

function DeckAccuracy({ deck, acc }: { deck: Deck; acc: Accuracy }) {
  return (
    <li className="py-3.5 first:pt-0 last:pb-0">
      <div className="mb-2.5 flex items-center gap-2.5">
        <Flag lang={deck.language} />
        <p className="min-w-0 flex-1 truncate font-medium">{deck.name}</p>
        <span className="text-xs text-muted tabular">{fmtNum.format(acc.n)} Abfragen</span>
      </div>
      <div className="grid gap-2 desk:grid-cols-2 desk:gap-6">
        <Meter label="Erkennen" value={acc.toNative} />
        <Meter label="Schreiben" value={acc.toTarget} />
      </div>
    </li>
  )
}

function Meter({ label, value }: { label: string; value: number | null }) {
  const w = Math.round((value ?? 0) * 100)
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-sm text-muted">{label}</span>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
        role="meter"
        aria-label={`${label}: ${value == null ? 'keine Daten' : pct(value)}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value == null ? undefined : w}
      >
        {value != null && <div className="h-full rounded-full bg-accent" style={{ width: `${w}%` }} />}
      </div>
      <span className="w-11 shrink-0 text-right text-sm font-medium tabular">{pct(value)}</span>
    </div>
  )
}

/* ---------- Mehr Statistik: Noten, Lernzeit, Lernarten, Tageszeit, schwierige Wörter ---------- */

function fmtMin(min: number): string {
  if (min <= 0) return '0 min'
  if (min < 1) return '< 1 min'
  return fmtDuration(min)
}

const fmtDate = new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'numeric' })

function Grades({ g, blocks }: { g: GradeStats; blocks: DeckBlocks[] }) {
  const data = g.history.map((h, i) => ({ i: i + 1, grade: h.grade, label: fmtDate.format(new Date(h.date)), block: h.block }))
  return (
    <div>
      {g.count > 0 && (
        <>
          <p className="mb-4 text-sm text-muted tabular">
            Ø <span className="font-medium text-fg">{g.average!.toFixed(1)}</span> · beste <span className="font-medium text-fg">{g.best!.toFixed(1)}</span> · letzte <span className="font-medium text-fg">{g.last!.toFixed(1)}</span> · {g.count} {g.count === 1 ? 'Test' : 'Tests'}
          </p>
          {data.length > 1 && (
            <div className="h-40" role="img" aria-label={`Noten aller Probetests, im Schnitt ${g.average!.toFixed(1)}, zuletzt ${g.last!.toFixed(1)}.`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--line)' }} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickMargin={6} minTickGap={16} />
                  <YAxis domain={[1, 6]} ticks={[1, 2, 3, 4, 5, 6]} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} width={28} />
                  <ReferenceLine y={4} stroke="var(--warn)" strokeDasharray="4 4" />
                  <Tooltip cursor={{ stroke: 'var(--line)', strokeWidth: 1 }} isAnimationActive={false} content={({ active, payload }) => {
                    const d = active && payload?.length ? (payload[0].payload as (typeof data)[number]) : null
                    return d ? <div className="rounded-lg bg-surface px-3 py-2 text-sm shadow-lg shadow-card"><p className="text-xs text-muted">{d.label} · {d.block ? 'Blocktest' : 'Probetest'}</p><p className="font-semibold tabular">Note {d.grade.toFixed(1)}</p></div> : null
                  }} />
                  <Line type="monotone" dataKey="grade" stroke="var(--accent)" strokeWidth={2} dot={{ r: 4, fill: 'var(--accent)', stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-2 text-xs text-muted">Schweizer Skala: 6 = alles richtig · 4 = genügend (gestrichelt)</p>
        </>
      )}
      {blocks.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {blocks.map((b) => (
            <li key={b.deck.id} className="py-3 last:pb-0">
              <a href="#/ueben?tab=bloecke" className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex min-w-0 flex-1 items-center gap-2 font-medium"><Flag lang={b.deck.language} /><span className="truncate">{b.deck.name} · Blöcke</span></span>
                <span className="flex gap-1.5">{b.states.map((x) => <span key={x.index} title={`Block ${x.index + 1}`}><GradeChip grade={x.grade} size="sm" /></span>)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TimeChart({ data, week }: { data: { date: string; minutes: number; answers: number }[]; week: { thisWeek: { answers: number; minutes: number }; lastWeek: { answers: number; minutes: number } } }) {
  const total = data.reduce((s, d) => s + d.minutes, 0)
  const days = data.filter((d) => d.answers > 0).length
  const rows = data.map((d) => ({ ...d, label: fmtShort.format(parseDay(d.date)) }))
  const diff = week.thisWeek.minutes - week.lastWeek.minutes
  return (
    <div>
      <p className="mb-4 text-sm text-muted tabular">
        <span className="font-medium text-fg">{fmtMin(total)}</span> in 14 Tagen{days ? <> · Ø {fmtMin(total / days)} an Lerntagen</> : null}
        {' · '}diese Woche {fmtMin(week.thisWeek.minutes)}{week.lastWeek.minutes > 0 && <> ({diff >= 0 ? '+' : '−'}{fmtMin(Math.abs(diff))} zur Vorwoche)</>}
      </p>
      <div className="h-40" role="img" aria-label={`Lernzeit pro Tag, insgesamt ${Math.round(total)} Minuten in 14 Tagen.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap={3}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--line)' }} tick={{ fill: 'var(--muted)', fontSize: 11 }} interval={3} tickMargin={6} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} width={32} tickFormatter={(v: number) => `${v}′`} />
            <Tooltip cursor={{ fill: 'var(--surface-2)' }} isAnimationActive={false} content={({ active, payload }) => {
              const d = active && payload?.length ? (payload[0].payload as (typeof rows)[number]) : null
              return d ? <div className="rounded-lg bg-surface px-3 py-2 text-sm shadow-lg shadow-card"><p className="text-xs text-muted">{fmtLong.format(parseDay(d.date))}</p><p className="font-semibold tabular">{fmtMin(d.minutes)} · {d.answers} Antworten</p></div> : null
            }} />
            <Bar dataKey="minutes" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted">Gemessen wird die Zeit pro Antwort; Probetests auf Papier zählen als Abfragen, aber ohne Zeit.</p>
    </div>
  )
}

function Bars({ rows }: { rows: { key: string; answers: number; accuracy: number | null; hl?: boolean }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.answers))
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-sm desk:grid-cols-[10rem_1fr_auto]">
          <span className={`truncate ${r.hl ? 'font-semibold text-fg' : 'text-muted'}`}>{r.key}</span>
          <span className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <span className="block h-full rounded-full bg-accent" style={{ width: `${(r.answers / max) * 100}%` }} />
          </span>
          <span className="w-[8.5rem] text-right tabular"><span className="font-medium">{fmtNum.format(r.answers)}</span><span className="text-muted">{r.accuracy == null ? '' : ` · ${Math.round(r.accuracy * 100)} % ✓`}</span></span>
        </li>
      ))}
    </ul>
  )
}

function Modes({ rows }: { rows: ModeRow[] }) {
  return <Bars rows={rows.map((r) => ({ key: r.mode, answers: r.answers, accuracy: r.accuracy }))} />
}

function Dayparts({ rows, best }: { rows: DaypartRow[]; best: string | null }) {
  return (
    <div>
      <p className="mb-4 text-sm text-muted">{best ? <>Am besten klappt es am <span className="font-medium text-fg">{best}</span>.</> : 'Ab 20 Antworten pro Tageszeit siehst du, wann du am besten lernst.'}</p>
      <Bars rows={rows.map((r) => ({ key: r.part, answers: r.answers, accuracy: r.accuracy, hl: r.part === best }))} />
    </div>
  )
}

function HardList({ rows }: { rows: (HardWord & { note: Note; deck?: Deck })[] }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.noteId}>
          <a href={r.deck ? `#/deck/${r.deck.id}` : '#/statistik'} className="-mx-2 flex min-h-12 items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2/60">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{r.note.term}</span>
              <span className="block truncate text-sm text-muted">{r.note.translation}</span>
            </span>
            <span className="shrink-0 rounded-full bg-bad-soft px-2.5 py-0.5 text-sm font-semibold text-bad tabular">{r.wrong}× falsch</span>
            <span className="w-14 shrink-0 text-right text-sm text-muted tabular">{Math.round(((r.total - r.wrong) / r.total) * 100)} % ✓</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
