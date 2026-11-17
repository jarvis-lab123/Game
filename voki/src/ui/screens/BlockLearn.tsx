import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Rating } from 'ts-fsrs'
import { db } from '../../db/db'
import { log } from '../../db/queries'
import { requestSync } from '../../db/autosync'
import { introduceBlock, markBlockLearned } from '../../db/blocks'
import { loadSettings } from '../../db/queries'
import type { Card, Deck, Note } from '../../lib/types'
import { READ_ROUNDS, blockStates, drillCurrent, drillFinished, drillMark, overallGrade, pickNextBlock, splitBlocks, startDrill, type BlockState, type DrillState } from '../../lib/blocks'
import { gradeTone } from '../../lib/papertest'
import { Badge, Button, Empty, Kbd, Progress, cx } from '../components'
import { Flag, IconBack, IconCheck, IconChevron, IconPlay, IconX } from '../icons'
import { go } from '../router'
import { AudioButton, faceOf } from './cards'
import { PaperTest, type PaperItem } from '../probe/PaperTest'
import { PaperHint, useCalmFocus } from '../probe/paper'

const HOME = '/ueben?tab=bloecke'
const GRADE_CLS = { good: 'bg-good-soft text-good', warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad' }

interface Word { card: Card; note: Note; item: PaperItem }
export interface DeckBlocks { deck: Deck; blocks: Word[][]; states: BlockState[] }

/** The card asked in a block: writing the foreign word if the deck asks it, else the deck's first direction. */
function blockDirection(d: Deck) {
  return d.directions.includes('toTarget') ? 'toTarget' : d.directions[0]
}

export async function loadDeckBlocks(d: Deck): Promise<DeckBlocks> {
  const dir = blockDirection(d)
  const cards = (await db.cards.where('deckId').equals(d.id).toArray()).filter((c) => c.direction === dir && !c.suspended).sort((a, b) => a.order - b.order)
  const notes = new Map((await db.notes.where('deckId').equals(d.id).toArray()).map((n) => [n.id, n]))
  const words: Word[] = []
  for (const card of cards) {
    const note = notes.get(card.noteId)
    if (!note) continue
    const f = faceOf(card, note, d)
    words.push({ card, note, item: { cardId: card.id, question: f.question, answer: f.answer, promptLabel: f.promptLabel, answerLang: f.answerLang } })
  }
  const blocks = splitBlocks(words)
  const tests = await db.tests.where('deckId').equals(d.id).toArray()
  return { deck: d, blocks, states: blockStates(blocks.map((b) => b.length), tests) }
}

export function GradeChip({ grade, size = 'md' }: { grade: number | null; size?: 'md' | 'sm' }) {
  const box = size === 'sm' ? 'h-8 min-w-8 text-[13px]' : 'h-10 min-w-10 text-[15px]'
  if (grade == null) return <span className={cx('grid shrink-0 place-items-center rounded-xl bg-surface-2 px-1.5 font-semibold text-muted', box)} aria-label="noch keine Note">–</span>
  return <span className={cx('grid shrink-0 place-items-center rounded-xl px-1.5 font-bold tabular', box, GRADE_CLS[gradeTone(grade)])} aria-label={`Note ${grade.toFixed(1)}`}>{grade.toFixed(1)}</span>
}

function range(blocks: Word[][], i: number) {
  const from = blocks.slice(0, i).reduce((s, b) => s + b.length, 0) + 1
  return `Wörter ${from}–${from + blocks[i].length - 1}`
}

/* ---------------- Übersicht (Tab „Blöcke“ unter Üben) ---------------- */
export function BlockHome() {
  const data = useLiveQuery(async () => {
    const decks = await db.decks.filter((d) => !d.archived).toArray()
    return Promise.all(decks.map(loadDeckBlocks))
  }, [])
  if (!data) return <div className="h-40" aria-busy="true" />
  const withWords = data.filter((d) => d.blocks.length > 0)
  if (withWords.length === 0) return <Empty title="Noch keine Wörter" action={<Button variant="primary" onClick={() => go('/import')}>Vokabeln importieren</Button>} />
  return (
    <div className="space-y-5">
      <div className="rounded-[22px] bg-surface p-5 shadow-card desk:p-6">
        <p className="text-[17px] font-semibold">Blocklernen mit Blatt und Stift</p>
        <ol className="mt-3 grid gap-2.5 text-sm desk:grid-cols-3">
          {[
            ['Zweimal durchgehen', 'Alle Wörter des Blocks mit Lösung anschauen – zwei Runden.'],
            ['Von Hand schreiben', 'Wort auf ein Blatt schreiben, Lösung aufdecken, selbst abhaken. Falsche kommen wieder, bis alle sitzen.'],
            ['Probetest mit Note', 'Alle Wörter des Blocks auf Papier. Die Note (Schweizer Skala) schliesst den Block ab.'],
          ].map(([t, d], k) => (
            <li key={t} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent tabular">{k + 1}</span>
              <span><span className="block font-semibold">{t}</span><span className="block text-muted">{d}</span></span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-muted">Sind alle Blöcke durch, kommt immer der Block mit der schlechtesten Note wieder dran.</p>
      </div>
      {withWords.map((d) => <DeckBlockCard key={d.deck.id} d={d} />)}
    </div>
  )
}

function DeckBlockCard({ d }: { d: DeckBlocks }) {
  const next = pickNextBlock(d.states)
  const avg = overallGrade(d.states)
  const graded = d.states.filter((s) => s.grade != null).length
  return (
    <section className="overflow-hidden rounded-[22px] bg-surface shadow-card">
      <div className="flex items-center gap-3 px-5 pb-3 pt-5">
        <Flag lang={d.deck.language} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">{d.deck.name}</p>
          <p className="text-sm text-muted tabular">{d.blocks.length} {d.blocks.length === 1 ? 'Block' : 'Blöcke'} à ca. {Math.round(d.blocks.reduce((s, b) => s + b.length, 0) / d.blocks.length)} Wörter · {graded}/{d.blocks.length} mit Note</p>
        </div>
        {avg != null && (
          <div className="flex shrink-0 items-center gap-2 text-sm text-muted">
            <span className="hidden desk:inline">Schnitt</span>
            <GradeChip grade={avg} />
          </div>
        )}
      </div>
      {next && (
        <div className="px-5 pb-4">
          <Button variant="primary" size="lg" className="w-full" onClick={() => go(`/bloecke?deck=${d.deck.id}&start=${next.index}`)}>
            <IconPlay /> {next.reason === 'neu' ? `Block ${next.index + 1} lernen` : `Block ${next.index + 1} wiederholen (schlechteste Note)`}
          </Button>
        </div>
      )}
      <ul className="divide-y divide-line border-t border-line">
        {d.states.map((s) => (
          <li key={s.index}>
            <a href={`#/bloecke?deck=${d.deck.id}&start=${s.index}`} className="flex min-h-14 items-center gap-3 px-5 py-2.5 transition-colors duration-150 hover:bg-surface-2/60">
              <GradeChip grade={s.grade} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Block {s.index + 1} {next?.index === s.index && <Badge tone="accent">als Nächstes</Badge>}</span>
                <span className="block truncate text-[13px] text-muted tabular">
                  {range(d.blocks, s.index)} · „{d.blocks[s.index][0].note.term}“ …{s.attempts > 1 ? ` · ${s.attempts} Tests, beste ${s.best!.toFixed(1)}` : ''}
                </span>
              </span>
              <IconChevron className="shrink-0 text-muted/60" />
            </a>
          </li>
        ))}
      </ul>
      <MarkLearned d={d} />
    </section>
  )
}

const GRADES = [4, 4.5, 5, 5.5, 6]

/** Blocks already learned elsewhere (other device, on paper): take them over with a grade. */
function MarkLearned({ d }: { d: DeckBlocks }) {
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState<number[]>([])
  const [grade, setGrade] = useState(4)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const save = async () => {
    setBusy(true)
    const retention = (await loadSettings(db)).desiredRetention
    for (const i of pick.sort((a, b) => a - b)) await markBlockLearned(db, d.deck.id, i, d.blocks.length, d.blocks[i].map((w) => w.card.id), grade, retention)
    requestSync()
    setMsg(`${pick.length === 1 ? `Block ${pick[0] + 1}` : `${pick.length} Blöcke`} übernommen – Note ${grade.toFixed(1)}. Diese Wörter kommen nicht mehr als neue Wörter.`)
    setPick([])
    setOpen(false)
    setBusy(false)
  }
  return (
    <div className="border-t border-line px-5 py-3">
      {msg && <p role="status" className="mb-2 rounded-xl bg-good-soft px-3 py-2 text-sm text-good">{msg}</p>}
      {!open ? (
        <button type="button" onClick={() => { setOpen(true); setMsg('') }} className="min-h-11 text-[15px] font-medium text-accent">Blöcke schon gelernt? Als gelernt übernehmen</button>
      ) : (
        <div className="space-y-3 py-1">
          <p className="text-sm text-muted">Zum Beispiel am PC oder auf Papier gelernt. Die Wörter gelten dann als gelernt und kommen nicht mehr als neue Wörter – erst viel später wieder zur Wiederholung.</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Blöcke wählen">
            {d.states.map((s) => {
              const on = pick.includes(s.index)
              return (
                <button key={s.index} type="button" aria-pressed={on} onClick={() => setPick((p) => (on ? p.filter((x) => x !== s.index) : [...p, s.index]))}
                  className={cx('min-h-11 rounded-full px-4 text-[15px] font-semibold transition-colors', on ? 'bg-accent text-on-accent' : 'bg-surface-2')}>
                  {on && '✓ '}Block {s.index + 1}
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Note">
            <span className="mr-1 text-sm font-medium text-muted">Note</span>
            {GRADES.map((g) => (
              <button key={g} type="button" role="radio" aria-checked={grade === g} onClick={() => setGrade(g)}
                className={cx('min-h-11 min-w-11 rounded-xl px-2 text-[15px] font-bold tabular', grade === g ? 'bg-fg text-bg' : 'bg-surface-2')}>{g.toFixed(1)}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="primary" disabled={!pick.length || busy} onClick={save}>Übernehmen</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------- Ablauf eines Blocks ---------------- */
type Phase = { k: 'read'; round: number; i: number } | { k: 'readDone' } | { k: 'drill' } | { k: 'test' }

function shuffled<T>(xs: T[]): T[] {
  const a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function BlockRun({ deckId, index }: { deckId: string; index: number }) {
  const [data, setData] = useState<DeckBlocks | null | undefined>(undefined)
  useEffect(() => {
    ;(async () => {
      const d = await db.decks.get(deckId)
      setData(d ? await loadDeckBlocks(d) : null)
    })()
  }, [deckId])
  if (data === undefined) return <div className="h-60" aria-busy="true" />
  const words = data?.blocks[index]
  if (!data || !words) return <div className="mx-auto max-w-[640px] px-4 pt-10"><Empty title="Diesen Block gibt es nicht" action={<Button onClick={() => go(HOME)}>Zurück</Button>} /></div>
  return <BlockFlow deck={data.deck} words={words} index={index} count={data.blocks.length} label={range(data.blocks, index)} />
}

function BlockFlow({ deck, words, index, count, label }: { deck: Deck; words: Word[]; index: number; count: number; label: string }) {
  const reduce = !!useReducedMotion()
  const [phase, setPhase] = useState<Phase>({ k: 'read', round: 1, i: 0 })
  const [order, setOrder] = useState(() => words)
  const [drill, setDrill] = useState<DrillState>(() => startDrill(words.map((w) => w.card.id)))
  const byId = useMemo(() => new Map(words.map((w) => [w.card.id, w])), [words])
  const title = `Block ${index + 1} von ${count}`

  if (phase.k === 'test') {
    return (
      <PaperTest
        deck={deck}
        items={shuffled(words).map((w) => w.item)}
        n={null}
        block={{ index, count, exitTo: HOME, againTo: `/bloecke?deck=${deck.id}&start=${index}`, title: `${title} · Probetest` }}
      />
    )
  }

  const N = words.length
  const progress = phase.k === 'read' ? ((phase.round - 1) * N + phase.i + 1) / (READ_ROUNDS * N) : phase.k === 'readDone' ? 1 : drill.done.length / N
  const step = phase.k === 'drill' ? 'Von Hand schreiben' : 'Durchgehen'

  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-[680px] items-center gap-3 px-4 py-3">
          <button onClick={() => go(HOME)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg" aria-label="Block verlassen (Esc)"><IconX /></button>
          <div className="min-w-0 flex-1">
            <Progress value={progress} tone={phase.k === 'drill' ? 'good' : 'accent'} label={`Fortschritt ${step}`} />
            <p className="mt-1 truncate text-[12px] text-muted"><span className="font-semibold text-fg">{title}</span> · {step}</p>
          </div>
          <span className="shrink-0 text-sm text-muted tabular">
            {phase.k === 'read' ? `${phase.i + 1}/${N}` : phase.k === 'drill' ? `${drill.done.length}/${N} ✓` : ''}
          </span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[680px] flex-1 px-4 pb-10 pt-6 desk:pt-10">
        {phase.k === 'read' && (
          <ReadCard
            deck={deck}
            w={order[phase.i]}
            i={phase.i}
            N={N}
            round={phase.round}
            reduce={reduce}
            onBack={() => phase.i > 0 && setPhase({ ...phase, i: phase.i - 1 })}
            onNext={() => {
              if (phase.i + 1 < N) return setPhase({ ...phase, i: phase.i + 1 })
              if (phase.round < READ_ROUNDS) { setOrder(shuffled(words)); setPhase({ k: 'read', round: phase.round + 1, i: 0 }) }
              else setPhase({ k: 'readDone' })
              window.scrollTo({ top: 0 })
            }}
            onSkip={() => setPhase({ k: 'readDone' })}
          />
        )}
        {phase.k === 'readDone' && <ReadDone n={N} label={label} reduce={reduce} onStart={() => { void introduceBlock(db, words.map((w) => w.card.id)).then(requestSync); setPhase({ k: 'drill' }) }} />}
        {phase.k === 'drill' && (
          <Drill deck={deck} drill={drill} byId={byId} reduce={reduce} words={words}
            onMark={(ok, ms) => {
              const id = drillCurrent(drill)
              const w = id ? byId.get(id) : null
              if (w) void log(db, { cardId: w.card.id, deckId: deck.id, timestamp: new Date().toISOString(), mode: 'hand', rating: Rating.Manual, typedAnswer: '', correct: ok, durationMs: ms }).then(requestSync)
              setDrill((s) => drillMark(s, ok))
            }}
            onTest={() => { setPhase({ k: 'test' }); window.scrollTo({ top: 0 }) }}
          />
        )}
      </div>
    </div>
  )
}

function keyFor(e: KeyboardEvent) {
  const t = e.target
  if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return null
  if (t instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')) return null
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  return e.key.toLowerCase()
}

function ReadCard({ deck, w, i, N, round, reduce, onNext, onBack, onSkip }: { deck: Deck; w: Word; i: number; N: number; round: number; reduce: boolean; onNext: () => void; onBack: () => void; onSkip: () => void }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return go(HOME)
      const k = keyFor(e)
      if (k === 'enter' || k === ' ' || k === 'arrowright') { e.preventDefault(); if (!e.repeat || k === 'arrowright') onNext() }
      else if (k === 'arrowleft' || k === 'backspace') { e.preventDefault(); onBack() }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })
  const n = w.note
  return (
    <div>
      <p className="mb-3 text-center text-sm font-medium text-muted">Durchgang {round} von {READ_ROUNDS} · Lies jedes Wort und sprich es leise mit</p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${round}-${i}`}
          className="rounded-[26px] bg-surface p-6 shadow-card desk:p-10"
          initial={reduce ? false : { opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 1 } : { opacity: 0, x: -28 }}
          transition={{ duration: reduce ? 0 : 0.16, ease: 'easeOut' }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-muted">{w.item.promptLabel}</p>
            <p className="shrink-0 text-sm font-medium text-muted tabular">Wort {i + 1} von {N}</p>
          </div>
          <p className="mt-3 break-words text-[22px] font-medium leading-snug text-muted desk:text-[26px]">{w.item.question}</p>
          <div className="mt-2 flex items-center gap-2">
            <p className="min-w-0 break-words text-[34px] font-semibold leading-[1.15] tracking-tight desk:text-[44px]" lang={w.item.answerLang}>{w.item.answer}</p>
            {w.item.answerLang !== 'de' && <AudioButton text={w.item.answer} lang={deck.language} />}
          </div>
          {(n.example || n.mnemonic || n.emoji) && (
            <div className="mt-5 space-y-1.5 border-t border-line pt-4 text-[15px]">
              {n.example && <p className="italic text-muted" lang={deck.language === 'other' ? undefined : deck.language}>{n.example}</p>}
              {(n.mnemonic || n.emoji) && <p>{n.emoji && <span className="mr-1.5" aria-hidden>{n.emoji}</span>}{n.mnemonic}</p>}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      <div className="mt-4 flex gap-2">
        <Button size="lg" variant="ghost" onClick={onBack} disabled={i === 0} kbd="←" aria-label="Zurück zum vorherigen Wort"><IconBack />Zurück</Button>
        <Button size="lg" variant="primary" className="flex-1" onClick={onNext} kbd="Enter">{i + 1 === N ? (round < READ_ROUNDS ? 'Zweiter Durchgang' : 'Fertig durchgegangen') : 'Weiter'}</Button>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-xs text-muted">
        <span className="hidden desk:inline"><Kbd>Enter</Kbd> / <Kbd>→</Kbd> weiter · <Kbd>←</Kbd> zurück · <Kbd>Esc</Kbd> verlassen</span>
        <button type="button" onClick={onSkip} className="min-h-11 rounded-full px-3 font-medium text-accent hover:bg-accent-soft">Kenn ich schon – direkt schreiben</button>
      </div>
    </div>
  )
}

function ReadDone({ n, label, reduce, onStart }: { n: number; label: string; reduce: boolean; onStart: () => void }) {
  const focus = useCalmFocus<HTMLButtonElement>()
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return go(HOME)
      const k = keyFor(e)
      if (k === 'enter' || k === ' ') { e.preventDefault(); onStart() }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })
  return (
    <motion.div className="rounded-[26px] bg-surface p-6 shadow-card desk:p-10" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <p className="text-sm font-medium text-muted">{label} · zweimal durchgegangen</p>
      <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.02em] desk:text-[32px]">Jetzt von Hand schreiben</h1>
      <ol className="mt-6 space-y-4">
        {[
          ['Wort ansehen und aufschreiben', 'Schreib die Übersetzung auf dein Blatt.'],
          ['Lösung aufdecken', 'Vergleiche Buchstabe für Buchstabe. Ein Buchstabe falsch = falsch.'],
          ['Abhaken', `Richtige sind erledigt. Falsche kommen in der nächsten Runde wieder – bis alle ${n} sitzen.`],
        ].map(([t, d], k) => (
          <li key={t} className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent tabular">{k + 1}</span>
            <span><span className="block text-[15px] font-semibold">{t}</span><span className="block text-sm text-muted">{d}</span></span>
          </li>
        ))}
      </ol>
      <Button ref={focus} variant="primary" size="lg" className="mt-7 w-full desk:w-auto" onClick={onStart} kbd="Enter">Los geht’s</Button>
    </motion.div>
  )
}

function Drill({ deck, drill, byId, words, reduce, onMark, onTest }: { deck: Deck; drill: DrillState; byId: Map<string, Word>; words: Word[]; reduce: boolean; onMark: (ok: boolean, ms: number) => void; onTest: () => void }) {
  const [shown, setShown] = useState(false)
  const shownAt = useRef(Date.now())
  const [roundSeen, setRoundSeen] = useState(1)
  const id = drillCurrent(drill)
  const w = id ? byId.get(id) : undefined
  const finished = drillFinished(drill)
  const between = !finished && drill.round > roundSeen
  const doneSet = new Set(drill.done)
  const focusTest = useCalmFocus<HTMLButtonElement>(finished)

  useEffect(() => { shownAt.current = Date.now() }, [id, drill.round, roundSeen])
  // time from seeing the word to checking it (writing on paper), capped like a normal answer
  const mark = (ok: boolean) => { if (!shown) return; setShown(false); onMark(ok, Math.min(60000, Date.now() - shownAt.current)) }
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return go(HOME)
      const k = keyFor(e)
      if (k == null || e.repeat) return
      if (finished) { if (k === 'enter') { e.preventDefault(); onTest() } return }
      if (between) { if (k === 'enter' || k === ' ') { e.preventDefault(); setRoundSeen(drill.round) } return }
      if (!shown && (k === 'enter' || k === ' ')) { e.preventDefault(); setShown(true) }
      else if (shown && (k === 'r' || k === '1' || k === 'arrowright')) { e.preventDefault(); mark(true) }
      else if (shown && (k === 'f' || k === '0' || k === 'arrowleft')) { e.preventDefault(); mark(false) }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  const left = drill.queue.length + drill.wrong.length

  return (
    <div className="space-y-5">
      <TickGrid words={words} done={doneSet} current={finished || between ? null : id} reduce={reduce} />
      {finished ? (
        <motion.div className="rounded-[26px] bg-surface p-6 text-center shadow-card desk:p-10" initial={reduce ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-good-soft text-good"><IconCheck width={32} height={32} strokeWidth={2.6} /></span>
          <p className="mt-4 text-[26px] font-bold tracking-tight">Alle {words.length} abgehakt!</p>
          <p className="mx-auto mt-1 max-w-[440px] text-[15px] text-muted">{drill.round === 1 ? 'Alles in der ersten Runde richtig.' : `Geschafft in ${drill.round} Runden.`} Jetzt der Probetest: alle Wörter nochmals auf ein frisches Blatt – dann gibt’s die Note.</p>
          <Button ref={focusTest} variant="primary" size="lg" className="mt-6 w-full desk:w-auto" onClick={onTest} kbd="Enter">Probetest starten</Button>
        </motion.div>
      ) : between ? (
        <motion.div key={`r${drill.round}`} className="rounded-[26px] bg-surface p-6 text-center shadow-card desk:p-10" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm font-medium text-muted">Runde {drill.round - 1} fertig</p>
          <p className="mt-1 text-[26px] font-bold tracking-tight"><span className="text-good tabular">{drill.done.length} ✓</span> · <span className="text-bad tabular">{left} nochmals</span></p>
          <p className="mx-auto mt-1 max-w-[440px] text-[15px] text-muted">Die falschen Wörter kommen jetzt in neuer Reihenfolge wieder. Schau sie dir vorher ruhig nochmals an.</p>
          <ul className="mx-auto mt-4 max-w-[440px] divide-y divide-line text-left">
            {drill.queue.map((qid) => {
              const x = byId.get(qid)!
              return <li key={qid} className="flex flex-wrap items-baseline gap-x-2 py-2"><span className="text-muted">{x.item.question}</span><span className="text-muted" aria-hidden>→</span><span className="font-semibold" lang={x.item.answerLang}>{x.item.answer}</span></li>
            })}
          </ul>
          <Button variant="primary" size="lg" className="mt-6 w-full desk:w-auto" onClick={() => setRoundSeen(drill.round)} kbd="Enter">Runde {drill.round} starten</Button>
        </motion.div>
      ) : w ? (
        <div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${drill.round}-${id}`}
              className="rounded-[26px] bg-surface p-6 shadow-card desk:p-10"
              initial={reduce ? false : { opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 1 } : { opacity: 0, x: -28 }}
              transition={{ duration: reduce ? 0 : 0.16, ease: 'easeOut' }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-muted">{w.item.promptLabel}</p>
                <p className="shrink-0 text-sm font-medium text-muted tabular">Runde {drill.round} · noch {left}</p>
              </div>
              <p className="mt-3 break-words text-[34px] font-semibold leading-[1.15] tracking-tight desk:text-[44px]">{w.item.question}</p>
              {shown ? (
                <motion.div className="mt-5 border-t border-line pt-4" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                  <p className="text-sm font-medium text-muted">Lösung – stimmt dein Blatt genau?</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="min-w-0 break-words text-[30px] font-semibold leading-tight tracking-tight text-accent desk:text-[36px]" lang={w.item.answerLang}>{w.item.answer}</p>
                    {w.item.answerLang !== 'de' && <AudioButton text={w.item.answer} lang={deck.language} />}
                  </div>
                </motion.div>
              ) : (
                <PaperHint number={drill.done.length + 1} reduce={reduce} className="mt-6" />
              )}
            </motion.div>
          </AnimatePresence>
          {shown ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MarkButton ok={false} onClick={() => mark(false)} />
              <MarkButton ok onClick={() => mark(true)} />
            </div>
          ) : (
            <Button size="lg" variant="primary" className="mt-4 w-full" onClick={() => setShown(true)} kbd="Enter">Lösung zeigen</Button>
          )}
          <p className="mt-4 hidden text-center text-xs text-muted desk:block"><Kbd>Enter</Kbd> Lösung · <Kbd>R</Kbd> richtig · <Kbd>F</Kbd> falsch · <Kbd>Esc</Kbd> verlassen</p>
        </div>
      ) : null}
    </div>
  )
}

function MarkButton({ ok, onClick }: { ok: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex min-h-[60px] select-none items-center justify-center gap-2 rounded-[18px] text-[17px] font-semibold transition-[filter,transform] duration-150 active:scale-[0.97] hover:brightness-[0.97] dark:hover:brightness-125',
        ok ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad',
      )}
    >
      {ok ? <IconCheck width={22} height={22} strokeWidth={2.6} /> : <IconX width={22} height={22} strokeWidth={2.6} />}
      {ok ? 'Richtig' : 'Falsch'}<span className="hidden font-medium opacity-80 min-[420px]:inline">{ok ? ' · abhaken' : ' · nochmals'}</span>
      <Kbd className="ml-1 hidden desk:inline-flex">{ok ? 'R' : 'F'}</Kbd>
    </button>
  )
}

/** One small box per word; it ticks green (with a pop) when the word is done. */
function TickGrid({ words, done, current, reduce }: { words: Word[]; done: Set<string>; current: string | null; reduce: boolean }) {
  return (
    <div className="rounded-[22px] bg-surface p-4 shadow-card" aria-label={`${done.size} von ${words.length} Wörtern abgehakt`} role="img">
      <div className="flex flex-wrap gap-1.5">
        {words.map((w) => {
          const ok = done.has(w.card.id)
          return (
            <motion.span
              key={w.card.id}
              className={cx('grid h-5 w-5 place-items-center rounded-[6px] desk:h-6 desk:w-6', ok ? 'bg-good text-white' : 'bg-surface-2', current === w.card.id && !ok && 'ring-2 ring-accent ring-offset-1 ring-offset-surface')}
              animate={ok && !reduce ? { scale: [1, 1.35, 1] } : { scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              {ok && <IconCheck width={12} height={12} strokeWidth={3.2} />}
            </motion.span>
          )
        })}
      </div>
    </div>
  )
}
