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
import { READ_ROUNDS, blockDayPlan, passed, blockStates, drillCurrent, drillFinished, drillMark, overallGrade, pickNextBlock, splitBlocks, startDrill, type BlockState, type DrillState } from '../../lib/blocks'
import { gradeTone, mergeSameGerman } from '../../lib/papertest'
import { clozeGap, needsOtherForm } from '../../lib/cloze'
import { diffChars, gradeAnswer, normalize, type AnswerLang } from '../../lib/grade'
import { markModel, markSentence, onlyAccents, sameSentence, startSentences, type SentenceQueue } from '../../lib/sentence'
import { Badge, Button, Empty, Kbd, Progress, cx } from '../components'
import { Flag, IconBack, IconCheck, IconChevron, IconPlay, IconX } from '../icons'
import { go } from '../router'
import { AnswerInput, AudioButton, SentenceWithTranslation, faceOf } from './cards'
import { BlockTrainer, blockParts } from './Trainer'
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
        <p className="text-[17px] font-semibold">Blocklernen: am Computer lernen, auf Papier testen</p>
        <ol className="mt-3 grid gap-2.5 text-sm desk:grid-cols-3">
          {[
            ['Am Computer lernen', 'In kleinen Portionen: einprägen, Paare, übersetzen, im Satz einsetzen.'],
            ['Test auf Papier', 'Alle Wörter des Blocks auf ein Blatt, dann selbst korrigieren.'],
            ['Note ab 4', 'Dann ist der Block geschafft. Unter 4 kommt er nochmals.'],
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
      {d.deck.examDate && <DayPlan d={d} />}
      {next && (
        <div className="px-5 pb-4">
          <Button variant="primary" size="lg" className="w-full" onClick={() => go(`/bloecke?deck=${d.deck.id}&start=${next.index}`)}>
            <IconPlay /> {next.reason === 'neu' ? `Block ${next.index + 1} lernen` : next.reason === 'nochmal' ? `Block ${next.index + 1} nochmals (unter 4)` : `Block ${next.index + 1} wiederholen (schlechteste Note)`}
          </Button>
        </div>
      )}
      <FinalTestRow d={d} />
      <ul className="divide-y divide-line border-t border-line">
        {d.states.map((s) => (
          <li key={s.index}>
            <a href={`#/bloecke?deck=${d.deck.id}&start=${s.index}`} className="flex min-h-14 items-center gap-3 px-5 py-2.5 transition-colors duration-150 hover:bg-surface-2/60">
              <GradeChip grade={s.grade} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Block {s.index + 1} {s.grade != null && s.grade < 4 ? <Badge tone="bad">nochmals</Badge> : next?.index === s.index && <Badge tone="accent">als Nächstes</Badge>}</span>
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

const fmtDay = new Intl.DateTimeFormat('de-CH', { weekday: 'short', day: 'numeric', month: 'numeric' })
const parseKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }

/** Blocks spread over the days until the test; every day starts with a short test of the earlier blocks. */
function DayPlan({ d }: { d: DeckBlocks }) {
  const plan = blockDayPlan(d.states, new Date(), d.deck.examDate!)
  if (!plan) return null
  const earlier = d.states.filter((s) => passed(s)).length
  const today = plan[0]
  // blocks learned before today (a block finished today is not „earlier“ yet)
  const before = d.states.filter((s) => passed(s) && !today.done.includes(s.index)).length
  const b = (xs: number[]) => xs.map((i) => `Block ${i + 1}`).join(' + ')
  return (
    <div className="mx-5 mb-4 rounded-2xl bg-surface-2 p-4">
      <p className="text-[15px] font-semibold">Tagesplan bis zum Test · {fmtDay.format(parseKey(d.deck.examDate!))}</p>
      <p className="mt-0.5 text-[13px] text-muted">Jeden Tag ein neuer Block – und alle bisherigen Blöcke musst du weiter können.</p>
      <ol className="mt-3 space-y-1.5 text-[14px]">
        {plan.map((day) => (
          <li key={day.date} className={cx('flex gap-3 rounded-xl px-2.5 py-1.5', day.today && 'bg-surface shadow-card')}>
            <span className={cx('w-[72px] shrink-0 tabular', day.today ? 'font-semibold' : 'text-muted')}>{day.today ? 'Heute' : fmtDay.format(parseKey(day.date))}</span>
            <span className="min-w-0">
              {day.done.length > 0 && <span className="font-medium text-good">✓ {b(day.done)} </span>}
              {day.learn.length > 0 && <span className="font-medium">{b(day.learn)} lernen</span>}
              {day.finalReview ? <span className="font-medium">Alles wiederholen: schlechtesten Block + Alle Fehler</span> : !day.learn.length && !day.done.length && <span className="text-muted">wiederholen</span>}
              {!day.finalReview && (!day.today || before > 0) && <span className="text-muted">{day.learn.length || day.done.length ? ' · ' : ''}Kurztest der früheren Blöcke</span>}
            </span>
          </li>
        ))}
      </ol>
      {earlier > 0 && (
        <div className="mt-3 flex flex-col gap-2 desk:flex-row">
          <Button onClick={() => go(`/bloecke?deck=${d.deck.id}&start=0&review=${Math.max(...d.states.filter((s) => passed(s)).map((s) => s.index)) + 1}`)}>Kurztest: 20 Wörter aus Block 1–{Math.max(...d.states.filter((s) => passed(s)).map((s) => s.index)) + 1}</Button>
          <Button onClick={() => go(`/knacknuss?src=fehler&deck=${d.deck.id}`)}>Alle Fehler trainieren</Button>
        </div>
      )}
      {today.learn.length === 0 && today.done.length > 0 && <p className="mt-3 text-[13px] font-medium text-good">Für heute ist dein Block geschafft. Morgen geht’s weiter.</p>}
    </div>
  )
}

/** Final test over all words + the last result with a way to learn its mistakes as a block. */
function FinalTestRow({ d }: { d: DeckBlocks }) {
  const last = useLiveQuery(async () => (await db.tests.where('deckId').equals(d.deck.id).toArray()).filter((t) => t.kind === 'final' || t.kind === 'errors').sort((a, b) => b.date.localeCompare(a.date))[0], [d.deck.id])
  const n = d.blocks.reduce((s, b) => s + b.length, 0)
  const wrong = last ? last.items.filter((i) => !i.correct).length : 0
  return (
    <div className="mx-5 mb-4 rounded-2xl border border-line p-4">
      <p className="text-[15px] font-semibold">Gesamttest auf Papier · alle {n} Wörter</p>
      <p className="mt-0.5 text-[13px] text-muted">Wie die Block-Tests, nur mit allem. Gleiche deutsche Wörter kommen einmal – dann alle französischen hinschreiben. Danach lernst du die falschen als eigenen Block.</p>
      {last && (
        <p className="mt-2 flex items-center gap-2 text-[13px] text-muted">
          <GradeChip grade={last.grade} size="sm" /> Letzter {last.kind === 'final' ? 'Gesamttest' : 'Fehler-Test'} · {new Date(last.date).toLocaleDateString('de-CH')} · {wrong} falsch
        </p>
      )}
      <div className="mt-3 flex flex-col gap-2 desk:flex-row">
        <Button onClick={() => go(`/bloecke?deck=${d.deck.id}&start=0&final=1`)}>Gesamttest starten</Button>
        {last && wrong > 0 && <Button variant="primary" onClick={() => go(`/bloecke?deck=${d.deck.id}&start=0&wrong=${last.id}`)}>Falsche als Block lernen ({wrong})</Button>}
      </div>
    </div>
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
type Phase = { k: 'choose' } | { k: 'train'; part?: number } | { k: 'sentences'; short: boolean } | { k: 'cards'; v: DrillVariant } | { k: 'read'; round: number; i: number } | { k: 'readDone' } | { k: 'drill' } | { k: 'test' }

function shuffled<T>(xs: T[]): T[] {
  const a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const REVIEW_SIZE = 20

/** `review` = number of earlier blocks: a short paper test (20 words) mixed from blocks 1..review. */
export function BlockRun({ deckId, index, review, final, wrong }: { deckId: string; index: number; review?: number; final?: boolean; wrong?: string }) {
  const [data, setData] = useState<DeckBlocks | null | undefined>(undefined)
  const [wrongIds, setWrongIds] = useState<Set<string> | null>(null)
  useEffect(() => {
    ;(async () => {
      const d = await db.decks.get(deckId)
      if (wrong) {
        const t = await db.tests.get(wrong)
        setWrongIds(new Set((t?.items ?? []).filter((i) => !i.correct).map((i) => i.cardId)))
      }
      setData(d ? await loadDeckBlocks(d) : null)
    })()
  }, [deckId, wrong])
  if (data === undefined || (wrong && !wrongIds)) return <div className="h-60" aria-busy="true" />
  if (data && final) return <FinalTest deck={data.deck} words={data.blocks.flat()} />
  if (data && wrong && wrongIds) {
    const ws = data.blocks.flat().filter((w) => wrongIds.has(w.card.id))
    if (!ws.length) return <div className="mx-auto max-w-[640px] px-4 pt-10"><Empty title="Keine falschen Wörter" action={<Button onClick={() => go(HOME)}>Zurück</Button>}>In diesem Test war alles richtig.</Empty></div>
    return <BlockFlow deck={data.deck} words={ws} index={-1} count={0} label={`${ws.length} Wörter aus dem Test`} custom={{ key: `wrong:${wrong}`, title: 'Fehler-Block', againTo: `/bloecke?deck=${deckId}&start=0&wrong=${wrong}` }} />
  }
  if (data && review) {
    const pool = data.blocks.slice(0, review).flat()
    if (!pool.length) return null
    return <ReviewTest deck={data.deck} pool={pool} review={review} />
  }
  const words = data?.blocks[index]
  if (!data || !words) return <div className="mx-auto max-w-[640px] px-4 pt-10"><Empty title="Diesen Block gibt es nicht" action={<Button onClick={() => go(HOME)}>Zurück</Button>} /></div>
  return <BlockFlow deck={data.deck} words={words} index={index} count={data.blocks.length} label={range(data.blocks, index)} />
}

/** The final test: all words of the deck on paper. Same German = asked once, all French words needed. */
function FinalTest({ deck, words }: { deck: Deck; words: Word[] }) {
  const [items] = useState(() => mergeSameGerman(shuffled(words).map((w) => w.item)))
  return (
    <PaperTest deck={deck} items={items} n={null} exitTo={HOME} kind="final" title={`Gesamttest · alle ${words.length} Wörter`}
      againTo={`/bloecke?deck=${deck.id}&start=0&final=1`} wrongTo={(id) => `/bloecke?deck=${deck.id}&start=0&wrong=${id}`} />
  )
}

function ReviewTest({ deck, pool, review }: { deck: Deck; pool: Word[]; review: number }) {
  const [items] = useState(() => shuffled(pool).slice(0, REVIEW_SIZE).map((w) => w.item))
  return <PaperTest deck={deck} items={items} n={null} exitTo={HOME} title={review === 1 ? 'Kurztest Block 1' : `Kurztest Block 1–${review}`} againTo={`/bloecke?deck=${deck.id}&start=0&review=${review}`} />
}

interface CustomBlock { key: string; title: string; againTo: string }
type Saved = { phase: Phase; part?: number }

function BlockFlow({ deck, words, index, count, label, custom }: { deck: Deck; words: Word[]; index: number; count: number; label: string; custom?: CustomBlock }) {
  const reduce = !!useReducedMotion()
  // remember where you are (part of the block, exercise) – the app may be closed any time
  const storeKey = `voki.blockpos:${deck.id}:${custom?.key ?? index}`
  const [saved, setSaved] = useState<Saved | null>(() => { try { return JSON.parse(localStorage.getItem(storeKey) ?? 'null') } catch { return null } })
  const [phase, setPhaseRaw] = useState<Phase>({ k: 'choose' })
  const remember = (s: Saved | null) => { setSaved(s); if (s) localStorage.setItem(storeKey, JSON.stringify(s)); else localStorage.removeItem(storeKey) }
  const setPhase = (p: Phase) => {
    setPhaseRaw(p)
    if (p.k === 'train' || p.k === 'sentences' || p.k === 'cards') remember({ phase: p, part: p.k === 'train' ? p.part ?? 0 : saved?.part })
    else if (p.k === 'test') remember(null)
  }
  const [order, setOrder] = useState(() => words)
  const [drill, setDrill] = useState<DrillState>(() => startDrill(words.map((w) => w.card.id)))
  const byId = useMemo(() => new Map(words.map((w) => [w.card.id, w])), [words])
  const title = custom?.title ?? `Block ${index + 1} von ${count}`

  if (phase.k === 'test') {
    const items = mergeSameGerman(shuffled(words).map((w) => w.item))
    return custom ? (
      <PaperTest deck={deck} items={items} n={null} exitTo={HOME} kind="errors" title={`${title} · Test`} againTo={custom.againTo}
        wrongTo={(id) => `/bloecke?deck=${deck.id}&start=0&wrong=${id}`} onPractice={() => { setPhase({ k: 'train' }); window.scrollTo({ top: 0 }) }} />
    ) : (
      <PaperTest
        deck={deck}
        items={items}
        n={null}
        block={{ index, count, exitTo: HOME, againTo: `/bloecke?deck=${deck.id}&start=${index}`, title: `${title} · Probetest` }}
        onPractice={() => { setPhase({ k: 'train' }); window.scrollTo({ top: 0 }) }}
      />
    )
  }

  const hasShort = words.some((w) => w.note.shortExample && w.note.shortTranslation)
  const hasLong = words.some((w) => w.note.example && w.note.exampleTranslation)
  const conjWords = words.filter((w) => w.note.example && needsOtherForm(w.note.term, w.note.gap))
  const hasConj = conjWords.length > 0
  const toPhase = (k: Pick): Phase =>
    k === 'train' ? { k: 'train', part: 0 } : k === 'classic' ? { k: 'read', round: 1, i: 0 } : k === 'short' ? { k: 'sentences', short: true } : k === 'long' ? { k: 'sentences', short: false } : k === 'flash' || k === 'write' || k === 'conj' ? { k: 'cards', v: k } : k === 'menu' ? { k: 'choose' } : { k: 'test' }
  const pick = (k: Pick) => {
    if (k !== 'test' && k !== 'menu') void introduceBlock(db, words.map((w) => w.card.id)).then(requestSync)
    setPhase(toPhase(k))
    window.scrollTo({ top: 0 })
  }
  const parts = blockParts(words.length)
  const resume = saved && saved.phase.k !== 'choose' ? saved : null
  const resumeLabel = resume ? (resume.phase.k === 'train' ? `Weitermachen: Teil ${(resume.part ?? 0) + 1} von ${parts}` : resume.phase.k === 'sentences' ? `Weitermachen: ${resume.phase.short ? 'kurze' : 'lange'} Sätze` : resume.phase.k === 'cards' ? `Weitermachen: ${DRILL_TITLE[resume.phase.v]}` : 'Weitermachen') : null
  if (phase.k === 'choose')
    return (
      <ChooseWay deck={deck} n={words.length} title={title} label={label} reduce={reduce} has={{ short: hasShort, long: hasLong, conj: hasConj }} onPick={pick}
        parts={parts} onPart={(i) => { void introduceBlock(db, words.map((w) => w.card.id)).then(requestSync); setPhase({ k: 'train', part: i }); window.scrollTo({ top: 0 }) }}
        resume={resume && resumeLabel ? { label: resumeLabel, go: () => { setPhase(resume.phase.k === 'train' ? { k: 'train', part: resume.part ?? 0 } : resume.phase); window.scrollTo({ top: 0 }) } } : null} />
    )
  if (phase.k === 'cards') return <WordDrill key={phase.v} deck={deck} words={phase.v === 'conj' ? conjWords : words} variant={phase.v} title={title} onPick={pick} />
  if (phase.k === 'train')
    return (
      <BlockTrainer
        picks={words.map((w) => ({ note: w.note, card: w.card, deck, score: 0, wrong: 0, reason: title }))}
        title={title}
        exitTo={HOME}
        startPart={phase.part ?? 0}
        onPart={(i) => remember({ phase: { k: 'train', part: i }, part: i })}
        onSkipToTest={() => { setPhase({ k: 'test' }); window.scrollTo({ top: 0 }) }}
        onFinished={() => { setPhase(hasShort ? { k: 'sentences', short: true } : hasLong ? { k: 'sentences', short: false } : { k: 'test' }); window.scrollTo({ top: 0 }) }}
      />
    )
  if (phase.k === 'sentences')
    return (
      <SentencePractice
        key={String(phase.short)}
        deck={deck}
        short={phase.short}
        words={words.filter((w) => (phase.short ? w.note.shortExample && w.note.shortTranslation : w.note.example && w.note.exampleTranslation))}
        title={title}
        onPick={pick}
        hasLong={hasLong}
      />
    )

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

/* ---------------- Übungsmodus: deutsche Sätze ins Französische ---------------- */
function SentencePractice({ deck, words, title, short, onPick, hasLong }: { deck: Deck; words: Word[]; title: string; short: boolean; onPick: (k: Pick) => void; hasLong: boolean }) {
  const onTest = () => onPick('test')
  const onWords = () => onPick('train')
  const model = (w: Word) => (short ? w.note.shortExample : w.note.example) ?? ''
  const german = (w: Word) => (short ? w.note.shortTranslation : w.note.exampleTranslation) ?? ''
  const reduce = !!useReducedMotion()
  const byId = useMemo(() => new Map(words.map((w) => [w.card.id, w])), [words])
  const [q, setQ] = useState<SentenceQueue>(() => startSentences(words.map((w) => w.card.id)))
  const [typed, setTyped] = useState('')
  const [shown, setShown] = useState<null | { auto: boolean; accents: boolean }>(null)
  const [hint, setHint] = useState(false)
  const id = q.order[0]
  const w = id ? byId.get(id) : undefined
  const N = words.length
  const next = (ok: boolean) => {
    if (!w) return
    void log(db, { cardId: w.card.id, deckId: deck.id, timestamp: new Date().toISOString(), mode: 'drill', rating: Rating.Manual, typedAnswer: typed, correct: ok, durationMs: 0 }).then(requestSync)
    setQ((x) => markSentence(x, ok))
    setTyped('')
    setShown(null)
    setHint(false)
  }
  const check = () => {
    if (!w || shown) return
    setShown({ auto: sameSentence(typed, model(w)), accents: onlyAccents(typed, model(w)) })
  }
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return go(HOME)
      if (!shown || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Enter') { e.preventDefault(); next(shown.auto) }
      else if (!shown.auto && (e.key === 'r' || e.key === 'R')) { e.preventDefault(); next(true) }
      else if (!shown.auto && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); next(false) }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })
  const lang = deck.language === 'other' ? undefined : deck.language
  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-[680px] items-center gap-3 px-4 py-3">
          <button onClick={() => go(HOME)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg" aria-label="Block verlassen (Esc)"><IconX /></button>
          <div className="min-w-0 flex-1">
            <Progress value={q.done.length / Math.max(1, N)} tone="good" label="Fortschritt Sätze" />
            <p className="mt-1 truncate text-[12px] text-muted"><span className="font-semibold text-fg">{title}</span> · {short ? 'Kurze Sätze' : 'Lange Sätze'} · {q.done.length}/{N}</p>
          </div>
          <Button size="sm" variant="primary" onClick={onTest}>Jetzt zum Test</Button>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[680px] flex-1 px-4 pb-10 pt-6 desk:pt-10">
        {!w ? (
          <div className="rounded-[26px] bg-surface p-6 text-center shadow-card desk:p-10">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-good-soft text-good"><IconCheck width={32} height={32} strokeWidth={2.6} /></span>
            <p className="mt-4 text-[26px] font-bold tracking-tight">Alle {N} Sätze geschafft!</p>
            <p className="mx-auto mt-1 max-w-[440px] text-[15px] text-muted">{Object.keys(q.wrong).length ? `${Object.keys(q.wrong).length} Sätze brauchten mehr als einen Versuch.` : 'Alles beim ersten Versuch.'} Jetzt der Test auf Papier.</p>
            <div className="mt-6 flex flex-col gap-2 desk:flex-row desk:justify-center">
              <Button variant="primary" size="lg" onClick={onTest}>Zum Test auf Papier</Button>
              {short && hasLong && <Button size="lg" onClick={() => onPick('long')}>Jetzt lange Sätze</Button>}
              <Button size="lg" onClick={onWords}>Nochmal mit den Wörtern üben</Button>
            </div>
          </div>
        ) : (
          <div>
            <motion.div key={`${id}-${q.done.length}-${Object.values(q.wrong).reduce((a, b) => a + b, 0)}`} className="rounded-[26px] bg-surface p-6 shadow-card desk:p-10" initial={reduce ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.16 }}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-accent">Übersetze ins Französische</p>
                {q.wrong[id] ? <span className="text-sm font-medium text-warn">nochmals</span> : null}
              </div>
              <p className="mt-3 hyphens-auto break-words text-[26px] font-semibold leading-snug tracking-tight desk:text-[30px]" lang="de">{german(w)}</p>
              {hint || shown ? (
                <p className="mt-2 text-[15px] text-muted">Wort: <span className="font-semibold text-fg" lang={lang}>{w.note.term}</span> = {w.note.translation}</p>
              ) : (
                <button type="button" onClick={() => setHint(true)} className="mt-2 min-h-11 text-[15px] font-medium text-accent">Tipp: Wort zeigen</button>
              )}
              {!shown ? (
                <div className="mt-4">
                  <textarea
                    autoFocus
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); check() } }}
                    lang={lang}
                    rows={2}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    aria-label="Dein Satz auf Französisch"
                    placeholder="Schreib den Satz auf Französisch …"
                    className="w-full resize-none rounded-2xl border border-line bg-bg px-4 py-3 text-[18px] outline-none focus:ring-2 focus:ring-accent"
                  />
                  {deck.language === 'fr' && <AccentRow onInsert={(c) => setTyped((t) => t + c)} />}
                  <Button size="lg" variant="primary" className="mt-3 w-full" onClick={check} kbd="Enter">{typed.trim() ? 'Prüfen' : 'Lösung zeigen'}</Button>
                </div>
              ) : (
                <div className="mt-5" role="status" aria-live="polite">
                  {shown.auto ? (
                    <div className="flex items-center gap-2 rounded-xl bg-good-soft px-3.5 py-2.5 text-[15px] font-semibold text-good"><IconCheck /> Genau richtig!</div>
                  ) : (
                    <p className="text-sm font-medium text-muted">{shown.accents ? 'Fast – schau die Akzente an:' : typed.trim() ? 'Vergleiche mit der Lösung (fehlende Wörter sind markiert):' : 'Lösung:'}</p>
                  )}
                  <p className="mt-2 text-[22px] font-semibold leading-snug" lang={lang}>
                    {markModel(typed, model(w)).map((t, i) => <span key={i} className={t.ok || !typed.trim() ? '' : 'rounded bg-bad-soft text-bad'}>{t.text}</span>)}
                  </p>
                  {typed.trim() && !shown.auto && <p className="mt-1 text-sm text-muted">Du: {typed}</p>}
                </div>
              )}
            </motion.div>
            {shown && (shown.auto ? (
              <Button size="lg" variant="primary" className="mt-4 w-full" onClick={() => next(true)} kbd="Enter">Weiter</Button>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button size="lg" onClick={() => next(false)} kbd="F">Falsch – nochmals</Button>
                <Button size="lg" variant="primary" onClick={() => next(true)} kbd="R">War richtig</Button>
              </div>
            ))}
            <div className="mt-4 flex flex-col items-center gap-1 text-center">
              <div className="flex flex-wrap justify-center gap-x-5">
                <button type="button" onClick={onWords} className="min-h-11 text-[15px] font-medium text-accent">Nochmal mit den Wörtern üben</button>
                <button type="button" onClick={() => onPick('menu')} className="min-h-11 text-[15px] font-medium text-accent">Andere Übung</button>
              </div>
              <p className="hidden text-xs text-muted desk:block"><Kbd>Enter</Kbd> prüfen · <Kbd>R</Kbd> richtig · <Kbd>F</Kbd> falsch · <Kbd>Esc</Kbd> verlassen</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const ACCENTS = ['é', 'è', 'ê', 'à', 'â', 'ç', 'î', 'ô', 'û', 'ù', 'ë', 'ï', 'œ']
function AccentRow({ onInsert }: { onInsert: (c: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Akzente">
      {ACCENTS.map((c) => <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onInsert(c)} className="grid h-10 w-10 place-items-center rounded-lg bg-surface-2 text-[17px] font-medium hover:brightness-95 dark:hover:brightness-125">{c}</button>)}
    </div>
  )
}

type DrillVariant = 'flash' | 'write' | 'conj'
type Pick = 'train' | 'flash' | 'write' | 'conj' | 'short' | 'long' | 'test' | 'classic' | 'menu'

function ChooseWay({ deck, n, title, label, reduce, onPick, has, parts, onPart, resume }: { deck: Deck; n: number; title: string; label: string; reduce: boolean; onPick: (k: Pick) => void; has: { short: boolean; long: boolean; conj: boolean }; parts: number; onPart: (i: number) => void; resume: { label: string; go: () => void } | null }) {
  const focus = useCalmFocus<HTMLButtonElement>()
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') go(HOME) }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
  const minutes = Math.round((n * 40) / 60 / 5) * 5
  const modes: { k: Pick; t: string; d: string; show: boolean }[] = [
    { k: 'flash', t: 'Karteikarten', d: 'Deutsch sehen, im Kopf sagen, umdrehen: gewusst oder nicht.', show: true },
    { k: 'write', t: 'Schreiben', d: 'Deutsch → Französisch tippen. Falsche kommen wieder.', show: true },
    { k: 'conj', t: 'Sätze 2.0', d: 'Der Satz ist schon da – nur das Wort in der richtigen Form einsetzen.', show: has.conj },
    { k: 'short', t: 'Kurze Sätze', d: 'Einfache Sätze mit 2–5 Wörtern ins Französische übersetzen.', show: has.short },
    { k: 'long', t: 'Lange Sätze', d: 'Längere Sätze übersetzen – für danach.', show: has.long },
  ]
  return (
    <div className="mx-auto w-full max-w-[680px] px-4 pb-10 pt-6 desk:pt-10">
      <button onClick={() => go(HOME)} className="mb-3 flex min-h-11 items-center gap-1 text-[15px] text-muted hover:text-fg"><IconBack /> Blöcke</button>
      <motion.div className="rounded-[26px] bg-surface p-6 shadow-card desk:p-10" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-sm font-medium text-muted">{deck.name} · {label}</p>
        <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.02em] desk:text-[32px]">{title} · {n} Wörter</h1>
        <p className="mt-2 text-[15px] text-muted">
          Empfohlen: <span className="font-medium text-fg">Block lernen</span> (ca. {minutes} Min) → {has.short ? 'kurze Sätze → ' : ''}Test auf Papier. Ab Note 4 ist der Block geschafft, darunter nochmals.
        </p>
        {resume && <Button ref={focus} variant="primary" size="lg" className="mt-6 w-full" onClick={resume.go}><IconPlay /> {resume.label}</Button>}
        <Button ref={resume ? undefined : focus} variant={resume ? undefined : 'primary'} size="lg" className={cx('w-full', resume ? 'mt-2' : 'mt-6')} onClick={() => onPick('train')}>{!resume && <IconPlay />} {resume ? 'Block von vorne lernen' : 'Block lernen'}</Button>
        <p className="mt-1.5 text-center text-[13px] text-muted">Einprägen, Paare, übersetzen, im Satz einsetzen – in {parts} Teilen</p>
        {parts > 1 && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label="Bei Teil einsteigen">
            <span className="mr-1 text-[13px] text-muted">Bei Teil einsteigen:</span>
            {Array.from({ length: parts }, (_, i) => (
              <button key={i} type="button" onClick={() => onPart(i)} className="grid h-10 min-w-10 place-items-center rounded-xl bg-surface-2 px-2 text-[15px] font-semibold tabular hover:brightness-95 dark:hover:brightness-125" aria-label={`Bei Teil ${i + 1} einsteigen`}>{i + 1}</button>
            ))}
          </div>
        )}
        <h2 className="mt-7 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Üben, wie du willst</h2>
        <div className="mt-2.5 grid gap-2 desk:grid-cols-2">
          {modes.filter((m) => m.show).map((m) => (
            <button key={m.k} type="button" onClick={() => onPick(m.k)} className="flex min-h-[64px] flex-col items-start justify-center rounded-2xl bg-surface-2 px-4 py-2.5 text-left transition-[filter,transform] duration-150 hover:brightness-95 active:scale-[0.98] dark:hover:brightness-125">
              <span className="text-[16px] font-semibold">{m.t}</span>
              <span className="text-[13px] text-muted">{m.d}</span>
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-2 desk:grid-cols-2">
          <Button onClick={() => onPick('test')}>Direkt zum Test auf Papier</Button>
          <Button variant="ghost" onClick={() => onPick('classic')}>Klassisch: lesen + von Hand</Button>
        </div>
      </motion.div>
    </div>
  )
}

/* ---------------- Karteikarten · Schreiben · Sätze 2.0 ---------------- */
const DRILL_TITLE: Record<DrillVariant, string> = { flash: 'Karteikarten', write: 'Schreiben', conj: 'Sätze 2.0' }

function WordDrill({ deck, words, variant, title, onPick }: { deck: Deck; words: Word[]; variant: DrillVariant; title: string; onPick: (k: Pick) => void }) {
  const reduce = !!useReducedMotion()
  const byId = useMemo(() => new Map(words.map((w) => [w.card.id, w])), [words])
  const [q, setQ] = useState<SentenceQueue>(() => startSentences(words.map((w) => w.card.id)))
  const [res, setRes] = useState<null | { ok: boolean; typed: string }>(null)
  const [flipped, setFlipped] = useState(false)
  const [typed, setTyped] = useState('')
  const id = q.order[0]
  const w = id ? byId.get(id) : undefined
  const N = words.length
  const lang = deck.language === 'other' ? undefined : deck.language
  const cz = w && variant === 'conj' ? clozeGap(w.note.term, w.note.example, w.note.gap) : null
  const expected = w ? (variant === 'conj' && cz ? cz.gap : w.item.answer) : ''
  const next = (ok: boolean) => {
    if (!w) return
    void log(db, { cardId: w.card.id, deckId: deck.id, timestamp: new Date().toISOString(), mode: variant === 'flash' ? 'flip' : 'drill', rating: Rating.Manual, typedAnswer: res?.typed ?? '', correct: ok, durationMs: 0 }).then(requestSync)
    setQ((x) => markSentence(x, ok))
    setRes(null)
    setFlipped(false)
    setTyped('')
  }
  const submit = () => {
    if (!w || res || !typed.trim()) return
    const r = gradeAnswer(typed, expected, { strictAccents: true, answerLang: w.item.answerLang as AnswerLang })
    setRes({ ok: r.verdict === 'correct', typed })
  }
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return go(HOME)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const k = e.key.toLowerCase()
      if (variant === 'flash') {
        if (!flipped && (k === ' ' || k === 'enter')) { e.preventDefault(); setFlipped(true) }
        else if (flipped && (k === 'r' || k === 'arrowright')) { e.preventDefault(); next(true) }
        else if (flipped && (k === 'f' || k === 'arrowleft')) { e.preventDefault(); next(false) }
      } else if (res && k === 'enter') { e.preventDefault(); next(res.ok) }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })
  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-[680px] items-center gap-3 px-4 py-3">
          <button onClick={() => go(HOME)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg" aria-label="Block verlassen (Esc)"><IconX /></button>
          <div className="min-w-0 flex-1">
            <Progress value={q.done.length / Math.max(1, N)} tone="good" label={`Fortschritt ${DRILL_TITLE[variant]}`} />
            <p className="mt-1 truncate text-[12px] text-muted"><span className="font-semibold text-fg">{title}</span> · {DRILL_TITLE[variant]} · {q.done.length}/{N}</p>
          </div>
          <Button size="sm" variant="primary" onClick={() => onPick('test')}>Jetzt zum Test</Button>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[680px] flex-1 px-4 pb-10 pt-6 desk:pt-10">
        {!w ? (
          <div className="rounded-[26px] bg-surface p-6 text-center shadow-card desk:p-10">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-good-soft text-good"><IconCheck width={32} height={32} strokeWidth={2.6} /></span>
            <p className="mt-4 text-[26px] font-bold tracking-tight">Alle {N} geschafft!</p>
            <p className="mx-auto mt-1 max-w-[440px] text-[15px] text-muted">{Object.keys(q.wrong).length ? `${Object.keys(q.wrong).length} Wörter brauchten mehr als einen Versuch – sie stehen jetzt in der Statistik.` : 'Alles beim ersten Versuch.'}</p>
            <div className="mt-6 flex flex-col gap-2 desk:flex-row desk:justify-center">
              <Button variant="primary" size="lg" onClick={() => onPick('test')}>Zum Test auf Papier</Button>
              <Button size="lg" onClick={() => onPick('menu')}>Andere Übung</Button>
            </div>
          </div>
        ) : (
          <div>
            <motion.div key={`${id}-${q.done.length}-${Object.values(q.wrong).reduce((a, b) => a + b, 0)}`} className="rounded-[26px] bg-surface p-6 shadow-card desk:p-10" initial={reduce ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.16 }}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-accent">{variant === 'conj' ? 'Setz das Wort in der richtigen Form ein' : w.item.promptLabel}</p>
                {q.wrong[id] ? <span className="text-sm font-medium text-warn">nochmals</span> : null}
              </div>
              {variant === 'conj' && cz ? (
                <div className="mt-3">
                  <p className="text-[24px] font-semibold leading-snug tracking-tight desk:text-[28px]" lang={lang}>
                    {cz.sentence.split('____')[0]}<span className="mx-1 inline-block min-w-[4ch] border-b-[3px] border-accent" aria-label="Lücke">&nbsp;</span>{cz.sentence.split('____')[1]}
                  </p>
                  <p className="mt-2 text-[15px] text-muted">Grundform: <span className="font-semibold text-fg" lang={lang}>{w.item.answer}</span> · {w.note.translation}</p>
                  {w.note.exampleTranslation && <p className="mt-1 text-[15px] text-muted" lang="de">„{w.note.exampleTranslation}“</p>}
                </div>
              ) : (
                <p className="mt-3 hyphens-auto break-words text-[32px] font-semibold leading-[1.15] tracking-tight desk:text-[40px]" lang="de">{w.item.question}</p>
              )}
              {variant === 'flash' ? (
                flipped ? (
                  <motion.div className="mt-5 border-t border-line pt-4" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 break-words text-[30px] font-semibold leading-tight tracking-tight text-accent" lang={lang}>{w.item.answer}</p>
                      <AudioButton text={w.item.answer} lang={deck.language} />
                    </div>
                    {w.note.shortExample && <p className="mt-2 text-[15px] italic text-muted" lang={lang}>{w.note.shortExample} <span className="not-italic">– {w.note.shortTranslation}</span></p>}
                  </motion.div>
                ) : (
                  <p className="mt-5 text-[15px] text-muted">Sag es im Kopf (oder laut) – dann umdrehen.</p>
                )
              ) : !res ? (
                <div className="mt-5">
                  <AnswerInput value={typed} onChange={setTyped} onSubmit={submit} lang={w.item.answerLang as AnswerLang} showAccents={deck.language === 'fr'} placeholder={variant === 'conj' ? 'Wort in der richtigen Form …' : 'Auf Französisch …'} ariaLabel="Deine Antwort" />
                  <Button size="lg" variant="primary" className="mt-3 w-full" disabled={!typed.trim()} onClick={submit} kbd="Enter">Prüfen</Button>
                </div>
              ) : (
                <div className="mt-5" role="status" aria-live="polite">
                  <div className={cx('flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[15px] font-semibold', res.ok ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad')}>
                    {res.ok ? <IconCheck /> : <IconX />} {res.ok ? 'Richtig!' : 'Noch nicht – kommt gleich nochmals'}
                  </div>
                  {!res.ok && (
                    <div className="mt-4">
                      <p className="text-sm text-muted">Richtig ist</p>
                      <p className="mt-1 break-words text-[28px] font-semibold leading-tight tracking-tight" lang={lang}>
                        {diffChars(normalize(res.typed), expected).map((d, i) => <span key={i} className={d.ok ? '' : 'rounded bg-bad-soft text-bad'}>{d.ch}</span>)}
                      </p>
                      <p className="mt-1 text-sm text-muted">Du: <span className="line-through">{res.typed}</span></p>
                    </div>
                  )}
                  {variant === 'conj' && w.note.example && <p className="mt-3 text-[15px] italic text-muted" lang={lang}>{w.note.example}</p>}
                </div>
              )}
            </motion.div>
            {variant === 'flash' ? (
              flipped ? (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Button size="lg" onClick={() => next(false)} kbd="F">Nicht gewusst</Button>
                  <Button size="lg" variant="primary" onClick={() => next(true)} kbd="R">Gewusst</Button>
                </div>
              ) : (
                <Button size="lg" variant="primary" className="mt-4 w-full" onClick={() => setFlipped(true)} kbd="Leertaste">Umdrehen</Button>
              )
            ) : res ? (
              <Button size="lg" variant="primary" className="mt-4 w-full" onClick={() => next(res.ok)} kbd="Enter">Weiter</Button>
            ) : null}
            <div className="mt-4 flex flex-wrap justify-center gap-x-5">
              <button type="button" onClick={() => onPick('train')} className="min-h-11 text-[15px] font-medium text-accent">Nochmal mit den Wörtern üben</button>
              <button type="button" onClick={() => onPick('menu')} className="min-h-11 text-[15px] font-medium text-accent">Andere Übung</button>
            </div>
          </div>
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
              {n.example && <SentenceWithTranslation note={n} lang={deck.language === 'other' ? undefined : deck.language} />}
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
