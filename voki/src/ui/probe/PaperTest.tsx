import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Rating } from 'ts-fsrs'
import { db } from '../../db/db'
import { loadSettings, log } from '../../db/queries'
import { applyBlockTest } from '../../db/blocks'
import { requestSync } from '../../db/autosync'
import type { Deck } from '../../lib/types'
import { nextOpen, paperScore, type Decision } from '../../lib/papertest'
import { uid } from '../../lib/id'
import { Button, Kbd, Progress, cx } from '../components'
import { IconBack, IconCheck, IconX } from '../icons'
import { go } from '../router'
import { GradeReveal } from './GradeReveal'
import { Counter, useCalmFocus, IconUndo, InkMark, PAPER_VARS, PaperHint, PointBadge, RULED, Typewriter } from './paper'

export interface PaperItem { cardId: string; question: string; answer: string; promptLabel: string; answerLang: string }
type Phase = 'intro' | 'write' | 'correct' | 'grade'

/** Is the key event meant for a focused control (so we must not handle it twice)? */
function forControl(e: KeyboardEvent) {
  const t = e.target
  if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return true
  return t instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')
}

export interface PaperBlock { index: number; count: number; exitTo: string; againTo: string; title: string }

export function PaperTest({ deck, items, n, block }: { deck: Deck; items: PaperItem[]; n: string | null; block?: PaperBlock }) {
  const exitTo = block?.exitTo ?? '/ueben'
  const reduce = !!useReducedMotion()
  const N = items.length
  const [phase, setPhase] = useState<Phase>('intro')
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const [decisions, setDecisions] = useState<Decision[]>(() => items.map(() => null))
  const [history, setHistory] = useState<number[]>([])
  const [cur, setCur] = useState(0)
  const [said, setSaid] = useState('')
  const saving = useRef(false)
  const score = paperScore(decisions)
  const allDone = cur >= N

  const start = () => { setPhase('write'); setI(0); setDir(1) }
  const forward = () => {
    if (i + 1 >= N) { setPhase('correct'); setCur(0); window.scrollTo({ top: 0 }); return }
    setDir(1)
    setI((x) => x + 1)
  }
  const backward = () => {
    if (i === 0) return
    setDir(-1)
    setI((x) => x - 1)
  }
  const decide = (ok: boolean) => {
    if (allDone) return
    const next = decisions.slice()
    next[cur] = ok
    setDecisions(next)
    setHistory((h) => [...h, cur])
    const k = nextOpen(next, cur)
    setCur(k < 0 ? N : k)
    setSaid(ok ? `Nummer ${cur + 1}: richtig, plus 1 Punkt` : `Nummer ${cur + 1}: falsch, 0 Punkte`)
  }
  const undo = () => {
    const last = history[history.length - 1]
    if (last == null) return
    setHistory((h) => h.slice(0, -1))
    setDecisions((d) => d.map((x, k) => (k === last ? null : x)))
    setCur(last)
    setSaid(`Rückgängig: Nummer ${last + 1} ist wieder offen`)
  }
  const toGrade = () => {
    if (!allDone) return
    setPhase('grade')
    window.scrollTo({ top: 0 })
  }

  // save once, when the grade is shown
  useEffect(() => {
    if (phase !== 'grade' || saving.current) return
    saving.current = true
    ;(async () => {
      const { points, grade } = paperScore(decisions)
      const now = new Date().toISOString()
      const graded = items.map((it, k) => ({ cardId: it.cardId, typed: '', correct: decisions[k] === true, confident: false, decided: decisions[k] != null })).filter((x) => x.decided)
      await db.transaction('rw', db.tests, db.logs, async () => {
        await db.tests.add({ id: uid(), deckId: deck.id, date: now, total: graded.length, correct: points, grade, items: graded.map(({ decided: _d, ...x }) => x), ...(block ? { block: block.index, blocks: block.count, applied: true } : {}), updatedAt: now })
        for (const a of graded) await log(db, { cardId: a.cardId, deckId: deck.id, timestamp: now, mode: 'test', rating: Rating.Manual, typedAnswer: '', correct: a.correct, durationMs: 0 })
      })
      // a block test is a clean recall: it moves the words forward in the learning progress
      if (block) await applyBlockTest(db, graded.map((a) => ({ cardId: a.cardId, correct: a.correct })), (await loadSettings(db)).desiredRetention)
      requestSync()
    })()
  }, [phase, decisions, items, deck.id, block])

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return go(exitTo)
      if (e.metaKey || e.ctrlKey || e.altKey || forControl(e)) return
      const k = e.key.toLowerCase()
      if (phase === 'intro' && (k === 'enter' || k === ' ')) { e.preventDefault(); start() }
      else if (phase === 'write') {
        if (k === 'enter' || k === ' ' || k === 'arrowright') { e.preventDefault(); if (!e.repeat || k === 'arrowright') forward() }
        else if (k === 'arrowleft' || k === 'backspace') { e.preventDefault(); backward() }
      } else if (phase === 'correct') {
        if (allDone && k === 'enter') { e.preventDefault(); toGrade() }
        else if (!e.repeat && (k === 'r' || k === '1' || k === 'arrowright')) { e.preventDefault(); decide(true) }
        else if (!e.repeat && (k === 'f' || k === '0' || k === 'arrowleft')) { e.preventDefault(); decide(false) }
        else if (k === 'backspace' || k === 'z' || k === 'u') { e.preventDefault(); undo() }
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  const progress = phase === 'intro' ? 0 : phase === 'write' ? (i + 1) / N : phase === 'correct' ? score.total / N : 1

  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-[680px] items-center gap-3 px-4 py-3">
          <button onClick={() => go(exitTo)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg" aria-label="Probetest abbrechen (Esc)"><IconX /></button>
          <Progress value={progress} tone={phase === 'write' || phase === 'intro' ? 'accent' : 'good'} label={phase === 'write' ? 'Fortschritt Schreiben' : 'Fortschritt Korrigieren'} />
          {phase === 'correct' ? (
            <span className="shrink-0 rounded-full bg-good-soft px-3 py-1 text-sm font-semibold text-good tabular" aria-label={`${score.points} von ${score.total} Punkten`}>
              <Counter value={score.points} reduce={reduce} /> / {score.total} <span className="font-medium">Punkte</span>
            </span>
          ) : (
            <span className="shrink-0 text-right text-sm text-muted tabular">{phase === 'write' ? `${i + 1}/${N}` : phase === 'grade' ? `${N}/${N}` : `0/${N}`}</span>
          )}
        </div>
      </header>
      <p className="sr-only" aria-live="polite">{said}</p>
      <div className="mx-auto w-full max-w-[680px] flex-1 px-4 pb-10 pt-6 desk:pt-10">
        {phase === 'intro' && <Intro n={N} reduce={reduce} onStart={start} title={block?.title} />}
        {phase === 'write' && <Write item={items[i]} i={i} N={N} dir={dir} reduce={reduce} onNext={forward} onBack={backward} />}
        {phase === 'correct' && (
          <Correct deck={deck} items={items} decisions={decisions} cur={cur} reduce={reduce} canUndo={history.length > 0} onDecide={decide} onUndo={undo} onGrade={toGrade} points={score.points} />
        )}
        {phase === 'grade' && <GradeReveal deck={deck} items={items} decisions={decisions} reduce={reduce} block={block} onAgain={() => go(`/probetest?deck=${deck.id}${n ? `&n=${n}` : ''}&paper=1&t=${Date.now()}`)} />}
      </div>
    </div>
  )
}

/* ---------------- Intro ---------------- */
function Intro({ n, reduce, onStart, title }: { n: number; reduce: boolean; onStart: () => void; title?: string }) {
  const focus = useCalmFocus<HTMLButtonElement>()
  const steps = [
    ['Wort ansehen', 'Du siehst immer nur das Wort. Schreib die Übersetzung auf dein Blatt.'],
    ['Weiter, weiter, weiter', `Bis alle ${n} Wörter durch sind. Mit Zurück kannst du nochmals schauen.`],
    ['Selbst korrigieren', 'Am Schluss zeigt Voki die Lösungen. Du sagst: richtig oder falsch. Dann kommt die Note.'],
  ]
  return (
    <motion.div className="rounded-[26px] bg-surface p-6 shadow-card desk:p-10" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <p className="text-sm font-medium text-muted">{title ?? 'Probetest auf Papier'}</p>
      <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.02em] desk:text-[32px]">Hol dir ein Blatt und einen Stift</h1>
      <SheetPreview n={n} reduce={reduce} />
      <ol className="mt-6 space-y-4">
        {steps.map(([t, d], k) => (
          <li key={t} className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent tabular">{k + 1}</span>
            <span>
              <span className="block text-[15px] font-semibold">{t}</span>
              <span className="block text-sm text-muted">{d}</span>
            </span>
          </li>
        ))}
      </ol>
      <Button variant="primary" size="lg" className="mt-7 w-full desk:w-auto" onClick={onStart} kbd="Enter" ref={focus}>Los geht’s</Button>
    </motion.div>
  )
}

/** A little sheet: numbers 1–3 get "written" one after another. */
function SheetPreview({ n, reduce }: { n: number; reduce: boolean }) {
  const widths = [96, 132, 78]
  return (
    <div className={cx(PAPER_VARS, 'relative mt-5 overflow-hidden rounded-2xl bg-[var(--paper)] pb-2 pt-3 shadow-[0_1px_2px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)]')} aria-hidden>
      <span className="absolute inset-y-0 left-[46px] w-[1.5px] bg-[var(--margin)]" />
      <div style={RULED}>
        {widths.map((w, k) => (
          <div key={k} className="flex h-8 items-start">
            <span className="w-[38px] text-right text-[15px] font-semibold leading-[30px] text-[var(--ink)] tabular">{k + 1}.</span>
            <svg width={w + 8} height="30" viewBox={`0 0 ${w + 8} 30`} className="ml-4 text-[var(--ink-blue)]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
              <motion.path
                d={`M4 22 ${Array.from({ length: Math.floor(w / 12) }, (_, j) => `q3 -${8 + ((j * 5 + k * 3) % 6)} 6 0 t6 0`).join(' ')}`}
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: 0.35 + k * 0.6, ease: 'easeInOut' }}
              />
            </svg>
          </div>
        ))}
        <div className="flex h-8 items-start">
          <span className="w-[38px] text-right text-[15px] font-semibold leading-[30px] text-[var(--ink-2)]">…</span>
          <span className="ml-4 text-[13px] leading-[30px] text-[var(--ink-2)]">bis {n}</span>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Schreiben ---------------- */
function Write({ item, i, N, dir, reduce, onNext, onBack }: { item: PaperItem; i: number; N: number; dir: number; reduce: boolean; onNext: () => void; onBack: () => void }) {
  const last = i + 1 === N
  return (
    <div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={i}
          className="rounded-[26px] bg-surface p-6 shadow-card desk:p-10"
          initial={reduce ? false : { opacity: 0, x: dir * 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 1 } : { opacity: 0, x: dir * -28 }}
          transition={{ duration: reduce ? 0 : 0.16, ease: 'easeOut' }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-muted">{item.promptLabel}</p>
            <p className="shrink-0 text-sm font-medium text-muted tabular">Wort {i + 1} von {N}</p>
          </div>
          <p className="mt-3 min-h-[2.3em] break-words desk:min-h-0 text-[34px] font-semibold leading-[1.15] tracking-tight desk:text-[44px]" aria-live="polite">{item.question}</p>
          <PaperHint number={i + 1} reduce={reduce} className="mt-6" />
        </motion.div>
      </AnimatePresence>
      <div className="mt-4 flex gap-2">
        <Button size="lg" variant="ghost" onClick={onBack} disabled={i === 0} kbd="←" aria-label="Zurück zum vorherigen Wort"><IconBack />Zurück</Button>
        <Button size="lg" variant="primary" className="flex-1" onClick={onNext} kbd="Enter">{last ? 'Fertig – jetzt korrigieren' : 'Weiter'}</Button>
      </div>
      <p className="mt-4 hidden text-center text-xs text-muted desk:block"><Kbd>Enter</Kbd> / <Kbd>Leertaste</Kbd> / <Kbd>→</Kbd> weiter · <Kbd>←</Kbd> zurück · <Kbd>Esc</Kbd> abbrechen</p>
    </div>
  )
}

/* ---------------- Korrigieren ---------------- */
function Correct({ deck, items, decisions, cur, reduce, canUndo, onDecide, onUndo, onGrade, points }: {
  deck: Deck; items: PaperItem[]; decisions: Decision[]; cur: number; reduce: boolean; canUndo: boolean; points: number
  onDecide: (ok: boolean) => void; onUndo: () => void; onGrade: () => void
}) {
  const N = items.length
  const allDone = cur >= N
  const scroller = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLDivElement | null)[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  const visible = items.slice(0, Math.min(cur + 1, N))

  // keep the current line in view (paper "scrolls up" like in a typewriter)
  useLayoutEffect(() => {
    const box = scroller.current
    const el = allDone ? endRef.current : lineRefs.current[cur]
    if (!box || !el) return
    const top = el.offsetTop + el.offsetHeight - box.clientHeight + 40
    box.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' })
  }, [cur, allDone, reduce])

  const date = new Date().toLocaleDateString('de-CH')
  return (
    <div>
      <p className="mb-3 px-1 text-[15px] text-muted"><span className="font-medium text-fg">Vergleiche mit deinem Blatt.</span> Ein Buchstabe falsch = kein Punkt.</p>
      <div className={cx(PAPER_VARS, 'relative')}>
        <div className="absolute inset-0 translate-y-1.5 rotate-[1.4deg] rounded-[14px] bg-[var(--paper-back)] shadow-[0_6px_18px_rgba(0,0,0,0.10)]" aria-hidden />
        <motion.div
          className="relative overflow-hidden rounded-[14px] bg-[var(--paper)] text-[var(--ink)] shadow-[0_1px_2px_rgba(0,0,0,0.10),0_12px_32px_rgba(0,0,0,0.10)]"
          initial={reduce ? false : { opacity: 0, y: 24, rotate: -1.5 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        >
          <span className="absolute inset-y-0 left-[46px] z-[1] w-[1.5px] bg-[var(--margin)] desk:left-[62px]" aria-hidden />
          <div className="flex items-end justify-between gap-3 pb-2 pl-[58px] pr-4 pt-4 desk:pl-[76px] desk:pr-6">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-2)]">Vokabeltest</p>
              <p className="truncate text-[17px] font-semibold">{deck.name}</p>
            </div>
            <p className="shrink-0 text-[13px] text-[var(--ink-2)] tabular">{date}</p>
          </div>
          <div ref={scroller} className="relative h-[344px] overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,#000_28px)] desk:h-[416px]" tabIndex={-1}>
            <div className="relative min-h-full pb-16" style={RULED}>
              {visible.map((it, k) => (
                <Line key={it.cardId} ref={(el) => { lineRefs.current[k] = el }} item={it} index={k} decision={decisions[k]} current={k === cur} reduce={reduce} />
              ))}
              {allDone && (
                <motion.div ref={endRef} className="flex h-16 items-end pl-[58px] pr-4 desk:pl-[76px]" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
                  <p className="text-[15px] font-semibold leading-[32px] text-[var(--ink-bad)]">Total: {points} / {N} Punkte</p>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="mt-5">
        {allDone ? (
          <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <GradeButton onClick={onGrade} />
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Choice ok={false} onClick={() => onDecide(false)} />
            <Choice ok onClick={() => onDecide(true)} />
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-3">
          <Button size="sm" variant="ghost" onClick={onUndo} disabled={!canUndo}><IconUndo />Rückgängig<Kbd className="ml-1">⌫</Kbd></Button>
          <span className="hidden text-right text-xs text-muted desk:block"><Kbd>R</Kbd> / <Kbd>→</Kbd> richtig · <Kbd>F</Kbd> / <Kbd>←</Kbd> falsch · <Kbd>Esc</Kbd> abbrechen</span>
        </div>
      </div>
    </div>
  )
}

function GradeButton({ onClick }: { onClick: () => void }) {
  const focus = useCalmFocus<HTMLButtonElement>()
  return <Button ref={focus} variant="primary" size="lg" className="w-full" onClick={onClick} kbd="Enter">Note ausrechnen</Button>
}

function Choice({ ok, onClick }: { ok: boolean; onClick: () => void }) {
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
      {ok ? 'Richtig' : 'Falsch'}
      <Kbd className="ml-1">{ok ? 'R' : 'F'}</Kbd>
    </button>
  )
}

function Line({ item, index, decision, current, reduce, ref }: { item: PaperItem; index: number; decision: Decision; current: boolean; reduce: boolean; ref: (el: HTMLDivElement | null) => void }) {
  return (
    <motion.div
      ref={ref}
      className="relative"
      initial={reduce ? false : { opacity: 0, y: 18, rotateX: -50 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      style={{ transformPerspective: 600 }}
      aria-current={current ? 'step' : undefined}
    >
      {current && !reduce && <motion.span layoutId="hl" className="absolute inset-y-0 left-[48px] right-0 bg-[var(--hl)] desk:left-[64px]" aria-hidden transition={{ type: 'spring', stiffness: 400, damping: 36 }} />}
      {current && reduce && <span className="absolute inset-y-0 left-[48px] right-0 bg-[var(--hl)] desk:left-[64px]" aria-hidden />}
      <motion.div
        key={`s-${decision}`}
        className="relative pl-[58px] pr-[52px] desk:pl-[76px] desk:pr-16"
        initial={{ x: 0 }}
        animate={decision === false && !reduce ? { x: [0, -7, 7, -5, 4, -2, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="absolute left-0 w-[40px] text-right text-[15px] font-semibold leading-[32px] tabular desk:w-[52px]">{index + 1}.</span>
        <p className="break-words text-[15px] leading-[32px] text-[var(--ink-2)]">{item.question}</p>
        <p className="break-words text-[21px] font-semibold leading-[32px] text-[var(--ink-blue)]">
          <Typewriter text={item.answer} full={decision != null} reduce={reduce} lang={item.answerLang} />
        </p>
        {decision != null && (
          <span className="absolute bottom-0 right-3 flex h-8 items-center desk:right-5">
            <InkMark ok={decision} reduce={reduce} />
          </span>
        )}
        {decision != null && !reduce && <PointBadge ok={decision} />}
        {decision != null && reduce && (
          <span className={cx('absolute bottom-[6px] right-12 desk:right-16 rounded-full px-2 py-0.5 text-[12px] font-bold tabular', decision ? 'bg-good text-white dark:text-black' : 'bg-[#8e8e93] text-white')} aria-hidden>{decision ? '+1' : '0'}</span>
        )}
      </motion.div>
    </motion.div>
  )
}

