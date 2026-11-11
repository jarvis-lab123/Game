import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Rating, type Grade } from 'ts-fsrs'
import { db } from '../../db/db'
import { loadSettings, log, planDay, sessionCards } from '../../db/queries'
import { SessionEngine, type Item } from '../../lib/session'
import { advanceLadder, applyReview } from '../../lib/srs'
import { gradeAnswer, normalize, type GradeResult } from '../../lib/grade'
import type { Card, Deck, Note, ReviewMode, Settings } from '../../lib/types'
import { speak, vibrate } from '../../platform'
import { Button, Empty, Kbd, Progress, Segmented, cx } from '../components'
import { IconCheck, IconX } from '../icons'
import { go } from '../router'
import { AnswerInput, CardShell, FeedbackView, FlipRatings, FlipView, IntroView, McView, StepLabel, faceOf, type Face } from './cards'

type Phase = 'ask' | 'feedback' | 'retype'
type ReviewStyle = 'type' | 'flip'

interface Ctx {
  engine: SessionEngine
  notes: Map<string, Note>
  decks: Map<string, Deck>
  settings: Settings
  total: number
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

function mcOptions(card: Card, face: Face, note: Note, notes: Map<string, Note>): string[] {
  const toTarget = card.direction === 'toTarget'
  const pool = [...notes.values()].filter((n) => n.deckId === card.deckId && n.id !== note.id)
  const ans = (n: Note) => (toTarget ? n.term : n.translation)
  const seen = new Set([normalize(face.answer)])
  const pick: string[] = []
  // prefer same gender (§5.2), then the rest
  for (const group of [shuffle(pool.filter((n) => note.gender && n.gender === note.gender)), shuffle(pool)])
    for (const n of group) {
      const k = normalize(ans(n))
      if (pick.length < 3 && !seen.has(k)) {
        seen.add(k)
        pick.push(ans(n))
      }
    }
  return shuffle([face.answer, ...pick])
}

export function Session({ deckId, extraMinutes }: { deckId?: string; extraMinutes: number }) {
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const [item, setItem] = useState<Item | null>(null)
  const [finished, setFinished] = useState(false)
  const [answered, setAnswered] = useState(0)
  const [right, setRight] = useState(0)
  const [introduced, setIntroduced] = useState(0)
  const [phase, setPhase] = useState<Phase>('ask')
  const [typed, setTyped] = useState('')
  const [retype, setRetype] = useState('')
  const [result, setResult] = useState<GradeResult | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [shake, setShake] = useState(0)
  const [style, setStyle] = useState<ReviewStyle>(() => (localStorage.getItem('voki.reviewStyle') as ReviewStyle) || 'type')
  const [elapsed, setElapsed] = useState(0)
  const [wrapped, setWrapped] = useState(false)
  const [dropped, setDropped] = useState(0)
  const [error, setError] = useState('')
  const shownAt = useRef(Date.now())
  const startedAt = useRef(Date.now())
  const busy = useRef(false)

  // build the session once
  useEffect(() => {
    let alive = true
    ;(async () => {
      const now = new Date()
      const settings = await loadSettings(db)
      const plan = await planDay(db, now, deckId)
      const { reviews, fresh, cram } = sessionCards(plan, now)
      const deckIds = plan.decks.map((d) => d.deck.id)
      const notes = new Map((await db.notes.where('deckId').anyOf(deckIds).toArray()).map((n) => [n.id, n]))
      const decks = new Map(plan.decks.map((d) => [d.deck.id, d.deck]))
      const engine = new SessionEngine({ reviews, fresh, cram })
      if (!alive) return
      setCtx({ engine, notes, decks, settings, total: engine.remaining() })
      setItem(engine.next())
    })()
    return () => {
      alive = false
    }
  }, [deckId])

  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now() - startedAt.current), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => localStorage.setItem('voki.reviewStyle', style), [style])

  const note = item && ctx ? ctx.notes.get(item.card.noteId) : undefined
  const deck = item && ctx ? ctx.decks.get(item.card.deckId) : undefined
  const face = item && note && deck ? faceOf(item.card, note, deck) : null
  const isRecall = item && ['review', 'practice', 'cram'].includes(item.step)
  const useFlip = isRecall && style === 'flip'
  const options = useMemo(() => (item?.step === 'mc' && face && note && ctx ? mcOptions(item.card, face, note, ctx.notes) : []), [item, face?.answer]) // eslint-disable-line react-hooks/exhaustive-deps

  const nextItem = useCallback(() => {
    if (!ctx) return
    const budget = (extraMinutes > 0 ? extraMinutes : ctx.settings.dailyMinutesGoal) * 60000
    if (!wrapped && Date.now() - startedAt.current > budget) {
      setDropped(ctx.engine.wrapUp())
      setWrapped(true)
    }
    const n = ctx.engine.next()
    setItem(n)
    if (!n) setFinished(true)
    setPhase('ask')
    setTyped('')
    setRetype('')
    setResult(null)
    setPicked(null)
    setFlipped(false)
    shownAt.current = Date.now()
  }, [ctx, extraMinutes, wrapped])

  /** Persist the outcome of the current item and move on. */
  const commit = useCallback(
    async (rating: Grade | 0, ok: boolean, typedAnswer?: string) => {
      if (!ctx || !item || !deck || busy.current) return
      busy.current = true
      setError('')
      try {
        const now = new Date()
        const ret = ctx.settings.desiredRetention
        const card = item.card
        let updated: Card = card
        let mode: ReviewMode = 'type'
        switch (item.step) {
          case 'intro': {
            updated = advanceLadder(card, 'intro', true, now, ret).card
            mode = 'intro'
            // the other direction of the same word skips its own intro
            const siblings = await db.cards.where('noteId').equals(card.noteId).toArray()
            for (const s of siblings)
              if (s.id !== card.id && s.stage === 'new') {
                const moved = { ...s, stage: 'mc' as const, updatedAt: now.toISOString() }
                await db.cards.put(moved)
                ctx.engine.updateCard(moved)
              }
            setIntroduced((x) => x + 1)
            break
          }
          case 'mc':
            updated = advanceLadder(card, 'mc', ok, now, ret).card
            mode = 'mc'
            break
          case 'type':
            updated = advanceLadder(card, 'type', ok, now, ret, (rating || Rating.Good) as Grade).card
            break
          case 'review':
            updated = applyReview(card, rating as Grade, now, ret)
            mode = useFlip ? 'flip' : 'type'
            break
          case 'cram':
            mode = 'cram'
            break
          case 'practice':
            mode = useFlip ? 'flip' : 'type'
            break
        }
        await db.transaction('rw', db.cards, db.logs, async () => {
          if (updated !== card) await db.cards.put(updated)
          await log(db, {
          cardId: card.id,
          deckId: card.deckId,
          timestamp: now.toISOString(),
          mode,
          rating: item.step === 'cram' || item.step === 'practice' ? Rating.Manual : rating,
          typedAnswer,
          correct: ok,
          durationMs: now.getTime() - shownAt.current,
          })
        })
        if (item.step !== 'intro') {
          setAnswered((x) => x + 1)
          if (ok) setRight((x) => x + 1)
        }
        ctx.engine.answer(item, ok, updated)
        nextItem()
      } catch (e) {
        setError(`Speichern fehlgeschlagen: ${(e as Error).message}. Versuch es nochmal.`)
      } finally {
        busy.current = false
      }
    },
    [ctx, item, deck, nextItem, useFlip],
  )

  // ----- actions -----
  const check = () => {
    if (!face || !deck || phase !== 'ask') return
    if (!typed.trim()) return
    const r = gradeAnswer(typed, face.answer, { strictAccents: deck.strictAccents, answerLang: face.answerLang })
    setResult(r)
    setPhase('feedback')
    if (r.verdict === 'correct') vibrate(12)
    else {
      vibrate([30, 40, 30])
      setShake((s) => s + 1)
      if (face.foreignLang !== 'other') speak(face.foreign, face.foreignLang)
    }
  }

  const proceedAfterFeedback = () => {
    if (!result) return
    if (result.verdict !== 'correct' && phase === 'feedback') {
      setPhase('retype')
      return
    }
    void commit(result.rating as Grade, result.rating !== Rating.Again, typed)
  }

  const submitRetype = () => {
    if (!result) return
    if (normalize(retype) === normalize(result.matched)) void commit(result.rating as Grade, result.rating !== Rating.Again, typed)
    else setShake((s) => s + 1)
  }

  const overrideRight = async (addAsSolution: boolean) => {
    if (!result || !note || !item) return
    if (addAsSolution && typed.trim()) {
      const field = item.card.direction === 'toTarget' ? 'term' : 'translation'
      const updatedNote = { ...note, [field]: `${note[field]}; ${typed.trim()}`, updatedAt: new Date().toISOString() }
      await db.notes.put(updatedNote)
      ctx?.notes.set(note.id, updatedNote)
    }
    void commit(Rating.Good, true, typed)
  }

  const pickMc = (i: number) => {
    if (picked != null || !face) return
    setPicked(i)
    const ok = options[i] === face.answer
    if (!ok) setShake((s) => s + 1)
    vibrate(ok ? 12 : [30, 40, 30])
  }

  // ----- keyboard (§7: Enter, Space, 1–4, Ctrl+Space, Esc) -----
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const inField = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      if (e.key === 'Enter' && e.target instanceof HTMLButtonElement) return // native click on the focused button
      if (e.key === 'Escape') {
        if (e.target instanceof HTMLTextAreaElement) return
        go('/')
        return
      }
      if (e.code === 'Space' && e.ctrlKey && face) {
        e.preventDefault()
        speak(face.foreign, face.foreignLang)
        return
      }
      if (!item || inField) return
      if (item.step === 'intro' && e.key === 'Enter') {
        e.preventDefault()
        void commit(0, true)
      } else if (item.step === 'mc') {
        if (picked == null && /^[1-4]$/.test(e.key) && Number(e.key) <= options.length) pickMc(Number(e.key) - 1)
        else if (picked != null && e.key === 'Enter') {
          e.preventDefault()
          void commit(0, options[picked] === face?.answer)
        }
      } else if (useFlip) {
        if (!flipped && (e.code === 'Space' || e.key === 'Enter')) {
          e.preventDefault()
          setFlipped(true)
        } else if (flipped && /^[1-4]$/.test(e.key)) void commit(Number(e.key) as Grade, Number(e.key) > 1)
      } else if (phase === 'feedback' && e.key === 'Enter') {
        e.preventDefault()
        proceedAfterFeedback()
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  // ----- render -----
  const remaining = ctx?.engine.remaining() ?? 0
  const progress = answered / Math.max(1, answered + remaining + (item ? 1 : 0))
  const mm = Math.floor(elapsed / 60000)
  const ss = String(Math.floor(elapsed / 1000) % 60).padStart(2, '0')

  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-[680px] items-center gap-3 px-4 py-3">
          <button onClick={() => go('/')} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg" aria-label="Session beenden (Esc)" title="Beenden (Esc) – alles ist gespeichert">
            <IconX />
          </button>
          <Progress value={finished ? 1 : progress} label="Fortschritt der Session" />
          <span className="w-12 shrink-0 text-right text-sm text-muted tabular" aria-label="Zeit">{mm}:{ss}</span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[680px] flex-1 flex-col px-4 pb-10 pt-6 desk:pt-12">
        {!ctx ? (
          <div className="h-60" aria-busy="true" />
        ) : finished || !item ? (
          <SessionEnd total={ctx.total} answered={answered} right={right} introduced={introduced} wrapped={wrapped && dropped > 0} deckId={deckId} extraMinutes={extraMinutes} empty={ctx.total === 0} />
        ) : !face || !note || !deck ? (
          <Empty title="Karte nicht gefunden">Diese Karte wurde gelöscht. <button className="text-accent underline" onClick={nextItem}>Weiter</button></Empty>
        ) : (
          <>
            {isRecall && (
              <div className="mb-4 flex justify-end">
                <Segmented label="Abfragemodus" value={style} onChange={setStyle} options={[{ value: 'type', label: 'Tippen' }, { value: 'flip', label: 'Umdrehen' }]} />
              </div>
            )}
            <CardShell shake={shake} label={<StepLabel step={item.step} leech={item.card.leech} />}>
              {item.step === 'intro' && (
                <IntroView
                  key={note.id}
                  note={note}
                  deck={deck}
                  onMnemonic={async (m) => {
                    const n = { ...note, mnemonic: m, updatedAt: new Date().toISOString() }
                    await db.notes.put(n)
                    ctx.notes.set(n.id, n)
                  }}
                />
              )}
              {item.step === 'mc' && <McView face={face} options={options} picked={picked} onPick={pickMc} />}
              {useFlip && <FlipView face={face} flipped={flipped} />}
              {(item.step === 'type' || (isRecall && !useFlip)) && (
                <div>
                  <p className="text-sm font-medium text-muted">{face.promptLabel}</p>
                  <p className="mt-1 break-words text-[32px] font-semibold leading-tight tracking-tight desk:text-[36px]">{face.question}</p>
                  {phase === 'ask' ? (
                    <div className="mt-6">
                      <AnswerInput value={typed} onChange={setTyped} onSubmit={check} lang={face.answerLang} showAccents={face.answerLang === 'fr'} placeholder="Antwort tippen …" ariaLabel="Deine Antwort" />
                    </div>
                  ) : (
                    result && <FeedbackView result={result} typed={typed} face={face} strict={deck.strictAccents} />
                  )}
                  {phase === 'retype' && result && (
                    <div className="mt-5">
                      <p className="mb-2 text-sm font-medium">Tipp die Lösung einmal ab</p>
                      <AnswerInput value={retype} onChange={setRetype} onSubmit={submitRetype} lang={face.answerLang} showAccents={face.answerLang === 'fr'} placeholder="Lösung abtippen …" ariaLabel="Lösung abtippen" />
                    </div>
                  )}
                </div>
              )}
            </CardShell>

            {/* action row */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {item.step === 'intro' && (
                <Button variant="primary" size="lg" className="w-full desk:w-auto" onClick={() => commit(0, true)} kbd="Enter">Weiter</Button>
              )}
              {item.step === 'mc' && picked != null && (
                <Button variant="primary" size="lg" className="w-full desk:w-auto" onClick={() => commit(0, options[picked] === face.answer)} kbd="Enter">Weiter</Button>
              )}
              {useFlip && !flipped && (
                <Button variant="primary" size="lg" className="w-full desk:w-auto" onClick={() => setFlipped(true)} kbd="Leertaste">Umdrehen</Button>
              )}
              {useFlip && flipped && <div className="w-full"><FlipRatings onRate={(r) => commit(r as Grade, r > 1)} /></div>}
              {!useFlip && (item.step === 'type' || isRecall) && phase === 'ask' && (
                <Button variant="primary" size="lg" className="w-full desk:w-auto" onClick={check} disabled={!typed.trim()} kbd="Enter">Prüfen</Button>
              )}
              {phase === 'feedback' && result && (
                <>
                  <Button variant="primary" size="lg" className="w-full desk:w-auto" onClick={proceedAfterFeedback} kbd="Enter">
                    {result.verdict === 'correct' ? 'Weiter' : 'Abtippen'}
                  </Button>
                  {result.verdict === 'correct' && item.step === 'review' && (
                    <Button variant="ghost" onClick={() => commit(Rating.Easy, true, typed)}>War zu leicht</Button>
                  )}
                  {result.verdict !== 'correct' && (
                    <>
                      <Button variant="ghost" onClick={() => overrideRight(false)}><IconCheck width={16} height={16} /> Ich hatte recht</Button>
                      <Button variant="ghost" className="text-muted" onClick={() => overrideRight(true)}>… und als Lösung speichern</Button>
                    </>
                  )}
                </>
              )}
              {phase === 'retype' && (
                <Button variant="primary" size="lg" className="w-full desk:w-auto" onClick={submitRetype} disabled={!retype.trim()} kbd="Enter">Weiter</Button>
              )}
            </div>
            {error && <p role="alert" className="mt-4 rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">{error}</p>}
            <p className="mt-auto hidden pt-10 text-center text-xs text-muted desk:block">
              <Kbd>Enter</Kbd> prüfen/weiter · <Kbd>Leertaste</Kbd> umdrehen · <Kbd>1</Kbd>–<Kbd>4</Kbd> wählen · <Kbd>Ctrl</Kbd>+<Kbd>Leertaste</Kbd> Audio · <Kbd>Alt</Kbd>+Buchstabe Akzent · <Kbd>Esc</Kbd> beenden
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function SessionEnd({ total, answered, right, introduced, wrapped, deckId, empty }: {
  total: number; answered: number; right: number; introduced: number; wrapped: boolean; deckId?: string; extraMinutes?: number; empty: boolean
}) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Enter' && go('/')
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
  if (empty)
    return (
      <Empty title="Gerade nichts zu lernen" action={<Button variant="primary" onClick={() => go('/')}>Zur Übersicht</Button>}>
        Keine fälligen Wiederholungen und keine neuen Wörter für heute. Morgen geht’s weiter.
      </Empty>
    )
  const rate = answered ? Math.round((right / answered) * 100) : 0
  const plus = `/lernen?plus=5&t=${Date.now()}${deckId ? `&deck=${deckId}` : ''}`
  return (
    <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-good-soft text-good"><IconCheck width={28} height={28} /></span>
      <h1 className="mt-4 text-[26px] font-semibold tracking-tight">{wrapped ? 'Zeit ist um, gut gemacht' : 'Fertig für heute'}</h1>
      <p className="mt-1 text-[15px] text-muted">Alles ist gespeichert.</p>
      <dl className="mx-auto mt-6 grid max-w-sm grid-cols-3 gap-3">
        <div><dt className="text-xs text-muted">Abgefragt</dt><dd className="text-[22px] font-semibold tabular">{answered}</dd></div>
        <div><dt className="text-xs text-muted">Richtig</dt><dd className={cx('text-[22px] font-semibold tabular', rate >= 80 ? 'text-good' : rate >= 60 ? 'text-warn' : 'text-bad')}>{rate} %</dd></div>
        <div><dt className="text-xs text-muted">Neue Wörter</dt><dd className="text-[22px] font-semibold tabular">{introduced}</dd></div>
      </dl>
      <div className="mt-8 flex flex-col gap-2 desk:flex-row desk:justify-center">
        <Button variant="primary" size="lg" onClick={() => go('/')} kbd="Enter">Zur Übersicht</Button>
        {wrapped && <Button size="lg" onClick={() => go(plus)}>Noch 5 Min?</Button>}
      </div>
      {total > 0 && !wrapped && <p className="mt-6 text-sm text-muted">Morgen kommen die nächsten Wiederholungen.</p>}
    </div>
  )
}
