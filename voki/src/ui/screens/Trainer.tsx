import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import { Rating } from 'ts-fsrs'
import { db } from '../../db/db'
import { log } from '../../db/queries'
import { requestSync } from '../../db/autosync'
import { NEW_SIZE, TRAINER_SIZE, clozeCandidates, crackWord, errorCandidates, newCandidates, trainerCandidates, type TrainerPick } from '../../db/trainer'
import { applyBlockTest, introduceBlock } from '../../db/blocks'
import { loadSettings } from '../../db/queries'
import { CLOZE_ONLY, EXERCISE_LABEL, TrainerEngine, fadeWord, scrambleTiles, spacePositions, writtenForm, type Exercise, type Tile, type TrainerItem } from '../../lib/trainer'
import { clozeGap, GAP } from '../../lib/cloze'
import { diffChars, gradeAnswer, normalize, type AnswerLang } from '../../lib/grade'
import { speak } from '../../platform'
import { Button, Empty, Kbd, Progress, cx } from '../components'
import { IconCheck, IconSound, IconX } from '../icons'
import { Illustration } from '../illustrations'
import { MnemonicStudio } from '../MnemonicStudio'
import { go } from '../router'
import { AnswerInput, AudioButton } from './cards'

const EXIT = '/ueben'

interface TWord { pick: TrainerPick; target: string; full: string; answerLang: AnswerLang; cloze: { sentence: string; gap: string } | null; canListen: boolean }

function toWord(p: TrainerPick): TWord {
  const lang: AnswerLang = p.deck.language === 'other' ? 'other' : p.deck.language
  const toTarget = p.card.direction === 'toTarget'
  const full = toTarget ? p.note.term : p.note.translation
  const canListen = toTarget && (lang === 'en' || lang === 'fr') && typeof window !== 'undefined' && 'speechSynthesis' in window
  return { pick: p, full, target: writtenForm(full), answerLang: toTarget ? lang : 'de', cloze: toTarget ? clozeGap(p.note.term, p.note.example) : null, canListen }
}
const question = (w: TWord) => (w.pick.card.direction === 'toTarget' ? w.pick.note.translation : w.pick.note.term)
const qLang = (w: TWord) => (w.pick.card.direction === 'toTarget' ? 'de' : w.pick.deck.language === 'other' ? undefined : w.pick.deck.language)

type Phase = 'loading' | 'empty' | 'learn' | 'match' | 'drill' | 'done'

export const CLOZE_SIZE = 12

/** knacknuss: the 8 worst · fehler: every wrong word at once · neu: new words (8 per round) · cloze: gap sentences only */
export type TrainerSource = 'knacknuss' | 'fehler' | 'neu'
const TITLE: Record<TrainerSource, string> = { knacknuss: 'Knacknuss-Training', fehler: 'Alle Fehler', neu: 'Neue Wörter' }

export function Trainer({ deckId, cloze = false, source = 'knacknuss' }: { deckId?: string; cloze?: boolean; source?: TrainerSource }) {
  const [words, setWords] = useState<TWord[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [left, setLeft] = useState(0)
  const [round, setRound] = useState(0)
  useEffect(() => {
    ;(async () => {
      const all = cloze ? await clozeCandidates(db, deckId, (p) => !!toWord(p).cloze) : source === 'fehler' ? await errorCandidates(db, deckId) : source === 'neu' ? await newCandidates(db, deckId) : await trainerCandidates(db, deckId)
      const size = cloze ? CLOZE_SIZE : source === 'fehler' ? all.length : source === 'neu' ? NEW_SIZE : TRAINER_SIZE
      // new words count as introduced as soon as you start with them
      if (source === 'neu' && !cloze) await introduceBlock(db, all.slice(0, size).map((p) => p.card.id))
      setLeft(Math.max(0, all.length - size))
      const w = all.slice(0, size).map(toWord)
      setWords(w)
      setPhase(w.length ? (cloze ? 'drill' : 'learn') : 'empty')
    })()
  }, [deckId, round, cloze, source])

  if (phase === 'loading') return <div className="h-60" aria-busy="true" />
  if (phase === 'empty')
    return (
      <div className="mx-auto max-w-[640px] px-4 pt-10">
        {cloze ? (
          <Empty title="Keine Lückensätze" action={<Button onClick={() => go(EXIT)}>Zurück</Button>}>Zu deinen Wörtern gibt es keine Beispielsätze, in denen das Wort vorkommt.</Empty>
        ) : source === 'neu' ? (
          <Empty title="Keine neuen Wörter" action={<Button onClick={() => go(EXIT)}>Zurück</Button>}>Alle Wörter sind schon eingeführt.</Empty>
        ) : source === 'fehler' ? (
          <Empty title="Keine Fehler" action={<Button onClick={() => go(EXIT)}>Zurück</Button>}>In den letzten 30 Tagen hattest du kein Wort falsch.</Empty>
        ) : (
          <Empty title="Keine Knacknüsse" action={<Button onClick={() => go(EXIT)}>Zurück</Button>}>
            Du hast keine Wörter, die wackeln oder die du in letzter Zeit falsch hattest. Mach einen Block oder einen Probetest – was dort falsch ist, landet hier.
          </Empty>
        )}
      </div>
    )
  return <TrainerRun key={round} words={words} left={left} phase={phase} cloze={cloze} source={source} setPhase={setPhase} onAgain={() => { setPhase('loading'); setRound((r) => r + 1) }} />
}

interface Embed { title: string; sub: string; exitTo: string; base: number; span: number }

function TrainerRun({ words, left, phase, cloze, source, setPhase, onAgain, embed }: { words: TWord[]; left: number; phase: Phase; cloze: boolean; source: TrainerSource; setPhase: (p: Phase) => void; onAgain: () => void; embed?: Embed }) {
  const reduce = !!useReducedMotion()
  const engine = useMemo(() => new TrainerEngine(words.map((w) => ({ id: w.pick.card.id, hasCloze: !!w.cloze, canListen: w.canListen })), cloze ? CLOZE_ONLY : source === 'neu' ? 'quick' : undefined), [words, cloze, source])
  const byId = useMemo(() => new Map(words.map((w) => [w.pick.card.id, w])), [words])
  const [learnI, setLearnI] = useState(0)
  const [turn, setTurn] = useState(0)
  const [cracked, setCracked] = useState<string[]>([])

  const local = phase === 'learn' ? (learnI / words.length) * 0.25 : phase === 'match' ? 0.3 : phase === 'drill' ? 0.3 + engine.progress * 0.7 : 1
  const progress = embed ? embed.base + embed.span * local : cloze ? (phase === 'done' ? 1 : engine.progress) : phase === 'learn' ? (learnI / words.length) * 0.15 : phase === 'match' ? 0.15 : phase === 'drill' ? 0.2 + engine.progress * 0.8 : 1
  const item = phase === 'drill' ? engine.current() : null

  const answer = (ok: boolean, typed = '') => {
    if (!item) return
    const w = byId.get(item.id)!
    // new words: early mistakes are normal while learning, only the free recall is logged
    const logged = source === 'neu' ? item.exercise === 'write' || item.exercise === 'final' : item.exercise !== 'scramble' && item.exercise !== 'fade'
    if (logged) {
      void log(db, { cardId: w.pick.card.id, deckId: w.pick.deck.id, timestamp: new Date().toISOString(), mode: 'drill', rating: Rating.Manual, typedAnswer: typed, correct: ok, durationMs: 0 })
    }
    const done = engine.answer(ok)
    if (done) {
      setCracked((c) => [...c, item.id])
      // a gap sentence gives context, so only the full exercise ladder counts as a review
      // in a block the paper test at the end decides (it moves the words forward)
      if (cloze || embed) requestSync()
      else if (source === 'neu') void loadSettings(db).then((st) => applyBlockTest(db, [{ cardId: item.id, correct: true }], st.desiredRetention)).then(requestSync)
      else void crackWord(db, item.id, engine.wrongCount(item.id) > 0).then(requestSync)
    }
    if (engine.finished) setPhase('done')
    setTurn((x) => x + 1)
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-[680px] items-center gap-3 px-4 py-3">
          <button onClick={() => go(embed?.exitTo ?? EXIT)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg" aria-label="Training beenden (Esc)"><IconX /></button>
          <div className="min-w-0 flex-1">
            <Progress value={progress} tone="good" label="Fortschritt Training" />
            <p className="mt-1 truncate text-[12px] text-muted">
              <span className="font-semibold text-fg">{embed ? embed.title : cloze ? 'Lückentext-Training' : TITLE[source]}</span>{embed && ` · ${embed.sub}`} · {phase === 'learn' ? 'Einprägen' : phase === 'match' ? 'Paare finden' : phase === 'drill' && item ? EXERCISE_LABEL[item.exercise] : 'Fertig'}
            </p>
          </div>
          <span className="shrink-0 text-sm text-muted tabular">{cracked.length}/{words.length} {cloze || embed ? '✓' : '🌰'}</span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[680px] flex-1 px-4 pb-10 pt-6 desk:pt-10">
        {phase === 'learn' && (
          <LearnCard
            w={words[learnI]}
            i={learnI}
            n={words.length}
            reduce={reduce}
            onNext={() => (learnI + 1 < words.length ? setLearnI(learnI + 1) : setPhase(words.length >= 2 ? 'match' : 'drill'))}
          />
        )}
        {phase === 'match' && <Match words={words} reduce={reduce} onDone={() => setPhase('drill')} />}
        {phase === 'drill' && item && <ExerciseView key={`${item.id}-${turn}`} item={item} w={byId.get(item.id)!} reduce={reduce} onAnswer={answer} clozeOnly={cloze} />}
        {phase === 'done' && <Done words={words} cracked={cracked} engine={engine} left={left} cloze={cloze} source={source} onAgain={onAgain} />}
      </div>
    </div>
  )
}

/**
 * Block learning on the computer: the block in portions of about 8 words – learn cards, pairs,
 * then per word a gap sentence (or the faded word) and one free recall. Calls onFinished at the end.
 */
export function BlockTrainer({ picks, title, exitTo, onFinished }: { picks: TrainerPick[]; title: string; exitTo: string; onFinished: () => void }) {
  const chunks = useMemo(() => {
    const k = Math.max(1, Math.round(picks.length / 8))
    const out: TrainerPick[][] = []
    for (let i = 0; i < k; i++) out.push(picks.slice(Math.round((i * picks.length) / k), Math.round(((i + 1) * picks.length) / k)))
    return out
  }, [picks])
  const [ci, setCi] = useState(0)
  const [phase, setPhase] = useState<Phase>('learn')
  const words = useMemo(() => chunks[ci].map(toWord), [chunks, ci])
  const next = (p: Phase) => {
    if (p !== 'done') return setPhase(p)
    if (ci + 1 < chunks.length) { setCi(ci + 1); setPhase('learn'); window.scrollTo({ top: 0 }) } else onFinished()
  }
  return (
    <TrainerRun key={ci} words={words} left={0} phase={phase} cloze={false} source="neu" setPhase={next} onAgain={() => {}}
      embed={{ title, sub: `Teil ${ci + 1}/${chunks.length}`, exitTo, base: ci / chunks.length, span: 1 / chunks.length }} />
  )
}

function useKeys(handler: (k: string, e: KeyboardEvent) => void) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target
      if (t instanceof HTMLTextAreaElement) return // writing a memory aid: Esc must not leave
      if (e.key === 'Escape') return go(EXIT)
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (t instanceof HTMLInputElement) return
      if (t instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')) return
      ref.current(e.key.toLowerCase(), e)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
}

const card = 'rounded-[26px] bg-surface p-6 shadow-card desk:p-10'

/* ---------- 1. Einprägen ---------- */
function LearnCard({ w, i, n, reduce, onNext }: { w: TWord; i: number; n: number; reduce: boolean; onNext: () => void }) {
  const [studio, setStudio] = useState(false)
  const [note, setNote] = useState(w.pick.note)
  useEffect(() => { setNote(w.pick.note); setStudio(false); if (w.canListen) speak(w.target, w.pick.deck.language) }, [w])
  useKeys((k, e) => { if (!studio && (k === 'enter' || k === ' ' || k === 'arrowright')) { e.preventDefault(); onNext() } })
  return (
    <div>
      <p className="mb-3 text-center text-sm font-medium text-muted">Einprägen {i + 1} von {n} · Lies es, sprich es laut, stell es dir vor</p>
      <motion.div key={w.pick.card.id} className={card} initial={reduce ? false : { opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
        <div className="flex items-center justify-between gap-3">
          <span className={cx('rounded-full px-2.5 py-0.5 text-[13px] font-semibold', w.pick.wrong > 0 ? 'bg-bad-soft text-bad' : 'bg-accent-soft text-accent')}>{w.pick.reason === 'neu' ? 'neues Wort' : w.pick.reason}</span>
          <span className="truncate text-sm text-muted">{w.pick.deck.name}</span>
        </div>
        <p className="mt-4 hyphens-auto break-words text-[22px] font-medium leading-snug text-muted" lang={qLang(w)}>{question(w)}</p>
        <div className="mt-1 flex items-center gap-2">
          <p className="min-w-0 break-words text-[36px] font-bold leading-[1.1] tracking-tight desk:text-[46px]" lang={w.answerLang}>{w.full}</p>
          {w.canListen && <AudioButton text={w.target} lang={w.pick.deck.language} />}
        </div>
        <Syllables word={w.target} />
        {note.example && <p className="mt-4 border-t border-line pt-4 text-[16px] italic text-muted" lang={w.answerLang}>{note.example}</p>}
        <div className="mt-4 rounded-2xl bg-surface-2 px-4 py-3">
          {note.mnemonic || note.emoji ? (
            <p className="text-[15px]">{note.emoji && <span className="mr-1.5" aria-hidden>{note.emoji}</span>}<span className="font-medium">Eselsbrücke:</span> {note.mnemonic}</p>
          ) : (
            <p className="text-[15px] text-muted">Noch keine Eselsbrücke. Ein lustiges Bild im Kopf hilft enorm.</p>
          )}
          {!studio ? (
            <button type="button" onClick={() => setStudio(true)} className="mt-1 min-h-11 text-[15px] font-semibold text-accent">{note.mnemonic || note.emoji ? 'Eselsbrücke ändern' : 'Eselsbrücke bauen'}</button>
          ) : (
            <div className="mt-3"><MnemonicStudio note={note} language={w.pick.deck.language} compact onSaved={(x) => { setNote(x); setStudio(false) }} /></div>
          )}
        </div>
      </motion.div>
      <Button size="lg" variant="primary" className="mt-4 w-full" onClick={onNext} kbd="Enter">{i + 1 < n ? 'Weiter' : 'Los geht’s'}</Button>
    </div>
  )
}

/** Splits a word into rough chunks to read and spell it piece by piece. */
function Syllables({ word }: { word: string }) {
  const parts = word.split(' ').map((w) => w.match(/[^aeiouyäöüéèàâêîôûœ]*[aeiouyäöüéèàâêîôûœ]+(?:[^aeiouyäöüéèàâêîôûœ]*$|[^aeiouyäöüéèàâêîôûœ](?=[^aeiouyäöüéèàâêîôûœ]))?/gi) ?? [w])
  if (parts.every((p) => p.length < 2)) return null
  return (
    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[17px] text-muted" aria-label="In Stücken gelesen">
      {parts.map((p, i) => <span key={i} className="tabular">{p.join(' · ')}</span>)}
    </p>
  )
}

/* ---------- 2. Paare finden ---------- */
function shuffle<T>(xs: T[]): T[] {
  const a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function Match({ words, reduce, onDone }: { words: TWord[]; reduce: boolean; onDone: () => void }) {
  const chunks = useMemo(() => { const a = shuffle(words); const out: TWord[][] = []; for (let i = 0; i < a.length; i += 6) out.push(a.slice(i, i + 6)); return out }, [words])
  const [ci, setCi] = useState(0)
  const next = () => (ci + 1 < chunks.length ? setCi(ci + 1) : onDone())
  return <MatchSet key={ci} set={chunks[ci]} part={chunks.length > 1 ? `${ci + 1}/${chunks.length}` : ''} last={ci + 1 >= chunks.length} reduce={reduce} onDone={next} onSkip={onDone} />
}

function MatchSet({ set, part, last, reduce, onDone, onSkip }: { set: TWord[]; part: string; last: boolean; reduce: boolean; onDone: () => void; onSkip: () => void }) {
  const [left] = useState(() => shuffle(set))
  const [right] = useState(() => shuffle(set))
  const [sel, setSel] = useState<string | null>(null)
  const [matched, setMatched] = useState<string[]>([])
  const [bad, setBad] = useState<string | null>(null)
  const [tries, setTries] = useState(0)
  const all = matched.length === set.length
  useKeys((k, e) => { if (all && k === 'enter') { e.preventDefault(); onDone() } })
  const pickRight = (id: string) => {
    if (!sel || matched.includes(id)) return
    setTries((t) => t + 1)
    if (id === sel) { setMatched((m) => [...m, id]); setSel(null) } else { setBad(id); setTimeout(() => setBad(null), 450) }
  }
  const tile = 'flex min-h-[56px] w-full items-center rounded-2xl px-4 py-2 text-left text-[16px] font-medium transition-[background,transform,opacity] duration-150 active:scale-[0.98]'
  return (
    <div>
      <div className={card}>
        <p className="text-sm font-medium text-muted">Paare finden{part && ` · ${part}`}</p>
        <p className="mt-1 text-[20px] font-bold tracking-tight">Tipp links ein Wort, dann rechts die Übersetzung</p>
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <div className="space-y-2.5">
            {left.map((w) => {
              const id = w.pick.card.id
              const done = matched.includes(id)
              return (
                <button key={id} type="button" disabled={done} onClick={() => setSel(id)} lang={w.answerLang}
                  className={cx(tile, done ? 'bg-good-soft text-good opacity-60' : sel === id ? 'bg-accent text-on-accent' : 'bg-surface-2 hover:brightness-95 dark:hover:brightness-125')}>
                  {done && <IconCheck width={16} height={16} className="mr-1.5 shrink-0" />}<span className="min-w-0 break-words">{w.target}</span>
                </button>
              )
            })}
          </div>
          <div className="space-y-2.5">
            {right.map((w) => {
              const id = w.pick.card.id
              const done = matched.includes(id)
              return (
                <motion.button key={id} type="button" disabled={done || !sel} onClick={() => pickRight(id)}
                  animate={bad === id && !reduce ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }} transition={{ duration: 0.35 }}
                  className={cx(tile, done ? 'bg-good-soft text-good opacity-60' : bad === id ? 'bg-bad-soft text-bad' : 'bg-surface-2 hover:brightness-95 disabled:hover:brightness-100 dark:hover:brightness-125')}>
                  {done && <IconCheck width={16} height={16} className="mr-1.5 shrink-0" />}<span className="min-w-0 hyphens-auto break-words" lang={qLang(w)}>{question(w)}</span>
                </motion.button>
              )
            })}
          </div>
        </div>
        <p className="mt-4 text-sm text-muted" role="status">{all ? `Alle Paare gefunden – mit ${tries} Versuchen.` : `${matched.length} von ${set.length} Paaren`}</p>
      </div>
      <Button size="lg" variant="primary" className="mt-4 w-full" disabled={!all} onClick={onDone} kbd={all ? 'Enter' : undefined}>{last ? 'Weiter zu den Übungen' : 'Nächste Paare'}</Button>
      {!all && <button type="button" onClick={onSkip} className="mt-2 min-h-11 w-full text-sm font-medium text-muted hover:text-fg">Überspringen</button>}
    </div>
  )
}

/* ---------- 3. Übungen ---------- */
interface Result { ok: boolean; typed: string }

function ExerciseView({ item, w, reduce, onAnswer, clozeOnly }: { item: TrainerItem; w: TWord; reduce: boolean; onAnswer: (ok: boolean, typed?: string) => void; clozeOnly?: boolean }) {
  const [res, setRes] = useState<Result | null>(null)
  const shake = useAnimationControls()
  const finish = (r: Result) => {
    setRes(r)
    if (!r.ok && !reduce) void shake.start({ x: [0, -8, 8, -5, 5, 0], transition: { duration: 0.35 } })
  }
  // right: move on by itself; wrong: read the solution, then Enter
  useEffect(() => {
    if (!res?.ok) return
    const t = setTimeout(() => onAnswer(true, res.typed), 750)
    return () => clearTimeout(t)
  }, [res])
  useKeys((k, e) => { if (res && !res.ok && k === 'enter') { e.preventDefault(); onAnswer(false, res.typed) } })

  const check = (typed: string) => {
    const r = gradeAnswer(typed, w.full, { strictAccents: true, answerLang: w.answerLang })
    const gapOk = item.exercise === 'cloze' && w.cloze && normalize(typed) === normalize(w.cloze.gap)
    finish({ ok: r.verdict === 'correct' || !!gapOk, typed })
  }

  return (
    <div>
      <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <motion.div className={card} animate={shake}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-accent">{EXERCISE_LABEL[item.exercise]}{clozeOnly ? (item.step === 0 ? ' · 1. Runde' : ' · 2. Runde') : ''}</p>
          <Steps step={item.step} steps={item.steps} />
        </div>
        <Prompt ex={item.exercise} w={w} />
        {!res ? (
          item.exercise === 'scramble' ? <Scramble target={w.target} lang={w.answerLang} onDone={(typed) => finish({ ok: normalize(typed) === normalize(w.target), typed })} />
            : <TypeIn w={w} ex={item.exercise} onSubmit={check} />
        ) : (
          <Feedback res={res} w={w} />
        )}
      </motion.div>
      </motion.div>
      {res && !res.ok && <Button size="lg" variant="primary" className="mt-4 w-full" onClick={() => onAnswer(false, res.typed)} kbd="Enter">Weiter – kommt gleich nochmal</Button>}
    </div>
  )
}

function Steps({ step, steps }: { step: number; steps: number }) {
  return (
    <span className="flex gap-1" aria-label={`Stufe ${step + 1} von ${steps}`}>
      {Array.from({ length: steps }, (_, i) => <span key={i} className={cx('h-1.5 w-4 rounded-full', i < step ? 'bg-good' : i === step ? 'bg-accent' : 'bg-surface-2')} />)}
    </span>
  )
}

function Prompt({ ex, w }: { ex: Exercise; w: TWord }) {
  const q = question(w)
  if (ex === 'cloze' && w.cloze) {
    const [a, b] = w.cloze.sentence.split(GAP)
    return (
      <div className="mt-3">
        <p className="text-[24px] font-semibold leading-snug tracking-tight desk:text-[28px]" lang={w.answerLang}>
          {a}<span className="mx-1 inline-block min-w-[4ch] border-b-[3px] border-accent align-baseline" aria-label="Lücke">&nbsp;</span>{b}
        </p>
        <p className="mt-2 text-[15px] text-muted">Deutsch: <span className="font-semibold text-fg">{q}</span></p>
      </div>
    )
  }
  if (ex === 'listen') return <ListenPrompt w={w} />
  return (
    <div className="mt-3">
      <p className="hyphens-auto break-words text-[32px] font-semibold leading-[1.15] tracking-tight desk:text-[40px]" lang={qLang(w)}>{q}</p>
      {ex === 'fade' && <p className="mt-3 font-mono text-[26px] tracking-[0.18em] text-muted" lang={w.answerLang} aria-label="Hilfe: einige Buchstaben">{fadeWord(w.target)}</p>}
      {ex === 'scramble' && <p className="mt-2 text-[15px] text-muted">Setz das Wort aus den Buchstaben zusammen.</p>}
      {ex === 'final' && <p className="mt-2 text-[15px] text-muted">Letzte Probe – ohne Hilfe, genau wie im Test.</p>}
    </div>
  )
}

function ListenPrompt({ w }: { w: TWord }) {
  const play = () => speak(w.target, w.pick.deck.language)
  useEffect(() => { play() }, [])
  return (
    <div className="mt-4 flex items-center gap-4">
      <button type="button" onClick={play} className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-accent text-on-accent shadow-card active:scale-95" aria-label="Nochmals anhören">
        <IconSound width={28} height={28} />
      </button>
      <div>
        <p className="text-[20px] font-semibold tracking-tight">Hör zu und schreib es</p>
        <p className="text-[15px] text-muted">Tipp auf den Lautsprecher, um es nochmals zu hören.</p>
      </div>
    </div>
  )
}

function TypeIn({ w, ex, onSubmit }: { w: TWord; ex: Exercise; onSubmit: (typed: string) => void }) {
  const [v, setV] = useState('')
  return (
    <div className="mt-5">
      <AnswerInput value={v} onChange={setV} onSubmit={() => v.trim() && onSubmit(v)} lang={w.answerLang} showAccents={w.answerLang === 'fr'} placeholder={ex === 'cloze' ? 'Fehlendes Wort …' : 'Schreib es …'} ariaLabel="Deine Antwort" />
      <Button size="lg" variant="primary" className="mt-3 w-full" disabled={!v.trim()} onClick={() => onSubmit(v)} kbd="Enter">Prüfen</Button>
    </div>
  )
}

function Scramble({ target, lang, onDone }: { target: string; lang: AnswerLang; onDone: (typed: string) => void }) {
  const [tiles] = useState<Tile[]>(() => scrambleTiles(target))
  const [picked, setPicked] = useState<Tile[]>([])
  const spaces = useMemo(() => spacePositions(target), [target])
  const n = tiles.length
  const build = (p: Tile[]) => {
    let s = ''
    p.forEach((t, i) => { if (spaces.includes(i)) s += ' '; s += t.ch })
    return s
  }
  const add = (t: Tile) => {
    const next = [...picked, t]
    setPicked(next)
    if (next.length === n) setTimeout(() => onDone(build(next)), 180)
  }
  const back = () => setPicked((p) => p.slice(0, -1))
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') { e.preventDefault(); back(); return }
      if (e.key.length !== 1) return
      const t = tiles.find((x) => !picked.includes(x) && x.ch.toLowerCase() === e.key.toLowerCase())
      if (t) { e.preventDefault(); add(t) }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })
  return (
    <div className="mt-5">
      <div className="flex min-h-14 flex-wrap items-center gap-1 rounded-2xl border-2 border-dashed border-line px-3 py-2" lang={lang} aria-live="polite" aria-label={`Gebaut: ${build(picked)}`}>
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className={cx('grid h-10 w-8 place-items-center rounded-lg text-[20px] font-semibold', spaces.includes(i) && 'ml-3', picked[i] ? 'bg-accent-soft text-accent' : 'border-b-2 border-muted/40')}>{picked[i]?.ch ?? ''}</span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {tiles.map((t) => {
          const used = picked.includes(t)
          return (
            <button key={t.id} type="button" disabled={used} onClick={() => add(t)} className={cx('grid h-12 w-11 place-items-center rounded-xl text-[20px] font-semibold shadow-card transition-[opacity,transform] duration-150 active:scale-90', used ? 'bg-surface-2 opacity-25' : 'bg-surface-2 hover:brightness-95 dark:hover:brightness-125')}>
              {t.ch}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-muted">
        <button type="button" onClick={back} disabled={!picked.length} className="min-h-11 rounded-full px-3 font-medium text-accent disabled:opacity-40">Letzten Buchstaben zurück</button>
        <span className="hidden desk:inline">Tippen geht auch mit der Tastatur · <Kbd>⌫</Kbd> zurück</span>
      </div>
    </div>
  )
}

function Feedback({ res, w }: { res: Result; w: TWord }) {
  return (
    <div className="mt-5" role="status" aria-live="polite">
      <div className={cx('flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[15px] font-semibold', res.ok ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad')}>
        {res.ok ? <IconCheck /> : <IconX />} {res.ok ? 'Richtig!' : 'Noch nicht – schau genau hin'}
      </div>
      {!res.ok && (
        <div className="mt-4">
          <p className="text-sm text-muted">Richtig ist</p>
          <p className="mt-1 break-words text-[30px] font-semibold leading-tight tracking-tight" lang={w.answerLang} aria-label={w.target}>
            {diffChars(normalize(res.typed), w.target).map((d, i) => <span key={i} className={d.ok ? '' : 'rounded bg-bad-soft text-bad'}>{d.ch}</span>)}
          </p>
          {res.typed && <p className="mt-1 text-sm text-muted">Du: <span className="line-through">{res.typed}</span></p>}
          {w.pick.note.mnemonic && <p className="mt-3 text-[15px]"><span className="font-medium">Eselsbrücke:</span> {w.pick.note.mnemonic}</p>}
          {w.pick.note.example && <p className="mt-3 text-[15px] italic text-muted" lang={w.answerLang}>{w.pick.note.example}</p>}
        </div>
      )}
    </div>
  )
}

/* ---------- Fertig ---------- */
function Done({ words, cracked, engine, left, cloze, source, onAgain }: { words: TWord[]; cracked: string[]; engine: TrainerEngine; left: number; cloze: boolean; source: TrainerSource; onAgain: () => void }) {
  const size = cloze ? CLOZE_SIZE : source === 'neu' ? NEW_SIZE : TRAINER_SIZE
  const focus = useRef<HTMLButtonElement>(null)
  useEffect(() => focus.current?.focus(), [])
  const clean = words.filter((w) => engine.wrongCount(w.pick.card.id) === 0).length
  return (
    <div className="space-y-5">
      <div className={cx(card, 'text-center')}>
        <div className="flex justify-center"><Illustration kind="done" size={110} /></div>
        <p className="mt-3 text-[26px] font-bold tracking-tight">{cloze ? `${cracked.length} Lückensätze gemeistert!` : source === 'neu' ? `${cracked.length} neue Wörter gelernt!` : source === 'fehler' ? `${cracked.length} Fehler ausgebügelt!` : `${cracked.length} Knacknüsse geknackt!`}</p>
        <p className="mx-auto mt-1 max-w-[440px] text-[15px] text-muted">{clean} davon ohne einen Fehler. Morgen nochmals kurz abfragen – dann bleiben sie hängen.</p>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-[22px] bg-surface shadow-card">
        {words.map((w) => {
          const n = engine.wrongCount(w.pick.card.id)
          return (
            <li key={w.pick.card.id} className="flex flex-wrap items-baseline gap-x-2 px-5 py-3">
              <span className="text-muted">{question(w)}</span><span className="text-muted" aria-hidden>→</span>
              <span className="font-semibold" lang={w.answerLang}>{w.full}</span>
              <span className={cx('ml-auto text-sm tabular', n ? 'text-warn' : 'text-good')}>{n ? `${n}× daneben` : 'fehlerfrei'}</span>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-col gap-2 desk:flex-row">
        {left > 0 && <Button ref={focus} variant="primary" size="lg" onClick={onAgain}>Nächste {Math.min(size, left)} {cloze ? 'Lückensätze' : source === 'neu' ? 'neuen Wörter' : 'Knacknüsse'}</Button>}
        <Button ref={left > 0 ? undefined : focus} variant={left > 0 ? undefined : 'primary'} size="lg" onClick={() => go(EXIT)}>Fertig</Button>
      </div>
    </div>
  )
}

/** Entry card (Heute, Fehlerheft): the training variants with how many words wait. */
export function KnacknussCard() {
  const [n, setN] = useState<{ hard: number; errors: number; fresh: number } | null>(null)
  useEffect(() => {
    void Promise.all([trainerCandidates(db), newCandidates(db)]).then(([h, f]) => setN({ hard: h.length, errors: h.filter((p) => p.wrong > 0).length, fresh: f.length }))
  }, [])
  if (n == null) return null
  return (
    <section className="rounded-[22px] bg-surface p-5 shadow-card">
      <div className="flex items-center gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-warn-soft text-[24px]" aria-hidden>🌰</span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold">Wörter knacken</p>
          <p className="text-sm text-muted">Eselsbrücke, Paare, Buchstabensalat, Lückentext, Hören und Schreiben – bis es sitzt.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 desk:grid-cols-2">
        {n.hard > 0 && <TrainButton primary title="Knacknüsse" sub={`die ${Math.min(TRAINER_SIZE, n.hard)} schwierigsten von ${n.hard}`} to="/knacknuss" />}
        {n.errors > 0 && <TrainButton primary={n.hard === 0} title="Alle Fehler" sub={`alle ${n.errors} falschen Wörter auf einmal`} to="/knacknuss?src=fehler" />}
        {n.fresh > 0 && <TrainButton primary={n.hard === 0 && n.errors === 0} title="Neue Wörter" sub={`${Math.min(NEW_SIZE, n.fresh)} von ${n.fresh} neuen · ca. 7 Min pro Runde`} to="/knacknuss?src=neu" />}
        <TrainButton title="Nur Lückentext" sub="das fehlende Wort im Satz – 12 Sätze" to="/knacknuss?cloze=1" />
      </div>
    </section>
  )
}

function TrainButton({ title, sub, to, primary }: { title: string; sub: string; to: string; primary?: boolean }) {
  return (
    <button type="button" onClick={() => go(to)} className={cx('flex min-h-14 w-full flex-col items-start justify-center rounded-2xl px-4 py-2.5 text-left transition-[filter,transform] duration-150 active:scale-[0.98]', primary ? 'bg-accent text-on-accent hover:brightness-110' : 'bg-surface-2 hover:brightness-95 dark:hover:brightness-125')}>
      <span className="text-[16px] font-semibold">{title}</span>
      <span className={cx('text-[13px]', primary ? '' : 'text-muted')}>{sub}</span>
    </button>
  )
}
