import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { Rating, type Grade } from 'ts-fsrs'
import { db } from '../../db/db'
import { loadSettings, log, planDay, sessionCards } from '../../db/queries'
import { drillCards, clearOverconfident, DRILL_SECONDS } from '../../db/drill'
import { requestSync } from '../../db/autosync'
import { SessionEngine, type Item } from '../../lib/session'
import { planGroups, type Group } from '../../lib/groups'
import { advanceLadder, applyReview } from '../../lib/srs'
import { gradeAnswer, normalize, type GradeResult } from '../../lib/grade'
import { applyHints, hintSteps } from '../../lib/hints'
import type { Card, Deck, Note, ReviewMode, Settings } from '../../lib/types'
import { setDueBadge, setFullscreen, speak, toggleFullscreen, vibrate } from '../../platform'
import { FullscreenButton } from '../fullscreen'
import { Button, Empty, Kbd, Progress, cx } from '../components'
import { IconCheck, IconPause, IconX } from '../icons'
import { Illustration } from '../illustrations'
import { MemoryAids } from '../MnemonicStudio'
import { go } from '../router'
import { AnswerInput, CardShell, FeedbackView, FlipRatings, FlipView, IntroView, McView, StepLabel, faceOf, type Face } from './cards'
import { GroupBreak, HandView, HintBar, LeechPause, ListenPrompt, SelfGradeButtons, type SelfGrade } from './session-views'
import type { StudyMode } from './SessionSetup'

type Phase = 'leech' | 'ask' | 'feedback' | 'retype' | 'between'

interface Ctx {
  groups: Group[]
  notes: Map<string, Note>
  decks: Map<string, Deck>
  settings: Settings
  total: number
  drill: boolean
}

const RECALL = new Set(['review', 'practice', 'cram'])
/** right answer, no retyping needed (German: other spelling also counts) */
const isRight = (v: GradeResult['verdict']) => v === 'correct' || v === 'spelling'

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

export function Session({ deckId, minutes, mode, drill }: { deckId?: string; minutes: number; mode: StudyMode; drill: boolean }) {
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const [groupIndex, setGroupIndex] = useState(0)
  const engine = useRef<SessionEngine | null>(null)
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
  const [revealed, setRevealed] = useState(false)
  const [hints, setHints] = useState(0)
  const [shake, setShake] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const pausedAt = useRef<number | null>(null)
  const [error, setError] = useState('')
  const [, force] = useState(0)
  const shownAt = useRef(Date.now())
  const startedAt = useRef(Date.now())
  const busy = useRef(false)
  const reduce = useReducedMotion()

  // ----- build session -----
  useEffect(() => {
    let alive = true
    ;(async () => {
      const now = new Date()
      const settings = await loadSettings(db)
      let groups: Group[]
      let deckIds: string[]
      if (drill) {
        const cards = await drillCards(db, minutes, deckId)
        groups = cards.length ? [{ reviews: [], fresh: [], cram: cards, seconds: cards.length * DRILL_SECONDS }] : []
        deckIds = [...new Set(cards.map((c) => c.deckId))]
      } else {
        const plan = await planDay(db, now, deckId)
        groups = planGroups(sessionCards(plan, now), minutes)
        deckIds = plan.decks.map((d) => d.deck.id)
      }
      const notes = new Map((await db.notes.where('deckId').anyOf(deckIds).toArray()).map((n) => [n.id, n]))
      const decks = new Map((await db.decks.bulkGet(deckIds)).filter((d): d is Deck => !!d).map((d) => [d.id, d]))
      if (!alive) return
      const total = groups.reduce((s, g) => s + g.reviews.length + g.fresh.length * 2 + g.cram.length * (drill ? 2 : 1), 0)
      setCtx({ groups, notes, decks, settings, total, drill })
      startGroup(groups, 0, drill, notes)
    })()
    return () => {
      alive = false
    }
  }, [deckId, minutes, drill]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => pausedAt.current == null && setElapsed(Date.now() - startedAt.current), 1000)
    return () => clearInterval(t)
  }, [])

  // leaving the session ends an automatic fullscreen
  useEffect(() => () => {
    void loadSettings(db).then((s) => {
      if (s.autoFullscreen) void setFullscreen(false)
    })
  }, [])

  const resetCard = () => {
    setTyped('')
    setRetype('')
    setResult(null)
    setPicked(null)
    setRevealed(false)
    setHints(0)
    shownAt.current = Date.now()
  }

  function startGroup(groups: Group[], i: number, isDrill: boolean, notes = ctx?.notes) {
    const g = groups[i]
    if (!g) {
      setItem(null)
      setFinished(true)
      return
    }
    engine.current = new SessionEngine(isDrill ? { reviews: [], fresh: [], cram: [], drill: g.cram } : { reviews: g.reviews, fresh: g.fresh, cram: g.cram })
    setGroupIndex(i)
    showNext(notes)
  }

  function showNext(notes = ctx?.notes) {
    const n = engine.current?.next() ?? null
    setItem(n)
    resetCard()
    if (!n) return
    const note = notes?.get(n.card.noteId)
    const needsAid = n.card.leech && RECALL.has(n.step) && note && !note.mnemonic && !note.emoji && !note.sketch
    setPhase(needsAid ? 'leech' : 'ask')
  }

  const afterGroup = useCallback(() => {
    if (!ctx) return
    if (groupIndex + 1 < ctx.groups.length) setPhase('between')
    else {
      setFinished(true)
      requestSync()
      void db.cards.toArray().then((cs) => setDueBadge(cs.filter((c) => c.stage === 'review' && !c.suspended && c.due <= Date.now()).length))
    }
  }, [ctx, groupIndex])

  const note = item && ctx ? ctx.notes.get(item.card.noteId) : undefined
  const deck = item && ctx ? ctx.decks.get(item.card.deckId) : undefined
  const face = item && note && deck ? faceOf(item.card, note, deck) : null
  const isRecall = !!item && RECALL.has(item.step)
  const typingStep = !!item && (item.step === 'type' || isRecall)
  const effMode: StudyMode = !typingStep ? 'type' : item!.step === 'type' && (mode === 'flip' || mode === 'listen') ? 'type' : mode
  const listenOk = effMode === 'listen' && item?.card.direction === 'toNative' && face?.foreignLang !== 'other' && 'speechSynthesis' in window
  const view: 'type' | 'hand' | 'listen' | 'flip' = effMode === 'listen' ? (listenOk ? 'listen' : 'type') : effMode
  const hintList = useMemo(() => (face && note ? hintSteps(face.answer, item?.card.direction === 'toTarget' ? note.example : undefined) : []), [face?.answer, note?.example, item?.card.direction]) // eslint-disable-line react-hooks/exhaustive-deps
  const options = useMemo(() => ((item?.step === 'mc' || item?.step === 'dmc') && face && note && ctx ? mcOptions(item.card, face, note, ctx.notes) : []), [item, face?.answer]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateNote = (n: Note) => {
    ctx?.notes.set(n.id, n)
    force((x) => x + 1)
  }

  /** Persist the outcome and move on. */
  const commit = useCallback(
    async (rating: Grade | 0, ok: boolean, typedAnswer?: string, modeOverride?: ReviewMode) => {
      if (!ctx || !item || !deck || busy.current) return
      busy.current = true
      setError('')
      try {
        const now = new Date()
        const ret = ctx.settings.desiredRetention
        const card = item.card
        let updated: Card = card
        let logMode: ReviewMode = modeOverride ?? (view === 'hand' ? 'hand' : view === 'listen' ? 'listen' : view === 'flip' ? 'flip' : 'type')
        const siblings: Card[] = []
        switch (item.step) {
          case 'intro': {
            updated = advanceLadder(card, 'intro', true, now, ret).card
            logMode = 'intro'
            for (const s of await db.cards.where('noteId').equals(card.noteId).toArray())
              if (s.id !== card.id && s.stage === 'new') siblings.push({ ...s, stage: 'mc', updatedAt: now.toISOString() })
            setIntroduced((x) => x + 1)
            break
          }
          case 'mc':
            updated = advanceLadder(card, 'mc', ok, now, ret).card
            logMode = 'mc'
            break
          case 'dmc':
            logMode = 'drill'
            break
          case 'type':
            updated = advanceLadder(card, 'type', ok, now, ret, (rating || Rating.Good) as Grade).card
            break
          case 'review':
            updated = applyReview(card, rating as Grade, now, ret)
            break
          case 'cram':
          case 'practice':
            if (ctx.drill) logMode = 'drill'
            break
        }
        await db.transaction('rw', db.cards, db.logs, async () => {
          if (updated !== card) await db.cards.put(updated)
          if (siblings.length) await db.cards.bulkPut(siblings)
          await log(db, {
            cardId: card.id,
            deckId: card.deckId,
            timestamp: now.toISOString(),
            mode: logMode,
            rating: ['cram', 'practice', 'dmc'].includes(item.step) ? Rating.Manual : rating,
            typedAnswer,
            correct: ok,
            durationMs: now.getTime() - shownAt.current,
          })
        })
        siblings.forEach((s) => engine.current?.updateCard(s))
        if (ctx.drill && ok && item.step === 'practice') await clearOverconfident(db, card.noteId)
        if (item.step !== 'intro') {
          setAnswered((x) => x + 1)
          if (ok) setRight((x) => x + 1)
        }
        engine.current?.answer(item, ok, updated)
        const n = engine.current?.next() ?? null
        if (!n) {
          setItem(null)
          afterGroup()
        } else {
          setItem(n)
          resetCard()
          const nn = ctx.notes.get(n.card.noteId)
          setPhase(n.card.leech && RECALL.has(n.step) && nn && !nn.mnemonic && !nn.emoji && !nn.sketch ? 'leech' : 'ask')
        }
      } catch (e) {
        setError(`Speichern fehlgeschlagen: ${(e as Error).message}. Versuch es nochmal.`)
      } finally {
        busy.current = false
      }
    },
    [ctx, item, deck, view, afterGroup],
  )

  /** Pause: clock stops, card hidden; paused time doesn't count for the time budget or answer speed. */
  const togglePause = useCallback(() => {
    if (pausedAt.current == null) {
      pausedAt.current = Date.now()
      setPaused(true)
    } else {
      const d = Date.now() - pausedAt.current
      startedAt.current += d
      shownAt.current += d
      pausedAt.current = null
      setPaused(false)
    }
  }, [])

  // ----- actions -----
  const check = () => {
    if (!face || !deck || phase !== 'ask' || !typed.trim()) return
    const strict = deck.strictAccents
    const r = gradeAnswer(typed, face.answer, { strictAccents: strict, answerLang: face.answerLang })
    const rating = applyHints(r.rating as Grade, hints)
    setResult({ ...r, rating })
    setPhase('feedback')
    if (isRight(r.verdict)) vibrate(12)
    else {
      vibrate([30, 40, 30])
      setShake((s) => s + 1)
      if (face.foreignLang !== 'other') speak(face.foreign, face.foreignLang)
    }
  }

  const proceedAfterFeedback = () => {
    if (!result) return
    if (!isRight(result.verdict) && phase === 'feedback') {
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
      const n = { ...note, [field]: `${note[field]}; ${typed.trim()}`, updatedAt: new Date().toISOString() }
      await db.notes.put(n)
      updateNote(n)
    }
    void commit(applyHints(Rating.Good, hints), true, typed)
  }

  const selfGrade = (g: SelfGrade) => {
    const rating = (g === 1 ? Rating.Again : g === 2 ? Rating.Hard : Rating.Good) as Grade
    vibrate(g === 1 ? [30, 40, 30] : 12)
    void commit(rating, g > 1, undefined, 'hand')
  }

  const pickMc = (i: number) => {
    if (picked != null || !face) return
    setPicked(i)
    const ok = options[i] === face.answer
    if (!ok) setShake((s) => s + 1)
    vibrate(ok ? 12 : [30, 40, 30])
  }

  const nextGroup = useCallback(() => {
    if (!ctx) return
    startGroup(ctx.groups, groupIndex + 1, ctx.drill)
  }, [ctx, groupIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // ----- keyboard (§7) -----
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const inField = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      if (e.key === 'Enter' && e.target instanceof HTMLButtonElement) return
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
      if (!inField && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        togglePause()
        return
      }
      if (paused) {
        if (e.key === 'Enter' || e.code === 'Space') {
          e.preventDefault()
          togglePause()
        }
        return
      }
      if (!inField && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        void toggleFullscreen()
        return
      }
      if (!item || inField || phase === 'between' || phase === 'leech') return
      if (item.step === 'intro' && e.key === 'Enter') {
        e.preventDefault()
        void commit(0, true)
      } else if (item.step === 'mc' || item.step === 'dmc') {
        if (picked == null && /^[1-4]$/.test(e.key) && Number(e.key) <= options.length) pickMc(Number(e.key) - 1)
        else if (picked != null && e.key === 'Enter') {
          e.preventDefault()
          void commit(0, options[picked] === face?.answer)
        }
      } else if (view === 'flip') {
        if (!revealed && (e.code === 'Space' || e.key === 'Enter')) {
          e.preventDefault()
          setRevealed(true)
        } else if (revealed && /^[1-4]$/.test(e.key)) void commit(Number(e.key) as Grade, Number(e.key) > 1)
      } else if (view === 'hand') {
        if (!revealed && e.key === 'Enter') {
          e.preventDefault()
          setRevealed(true)
        } else if (revealed && /^[1-3]$/.test(e.key)) selfGrade(Number(e.key) as SelfGrade)
      } else if (phase === 'feedback' && e.key === 'Enter') {
        e.preventDefault()
        proceedAfterFeedback()
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  // ----- swipe in flip mode (links = nochmal, rechts = gut) -----
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (!revealed) return
    if (info.offset.x > 110) void commit(Rating.Good, true)
    else if (info.offset.x < -110) void commit(Rating.Again, false)
  }

  // ----- render -----
  const remaining = engine.current?.remaining() ?? 0
  const laterGroups = ctx ? ctx.groups.slice(groupIndex + 1).reduce((s, g) => s + g.reviews.length + g.fresh.length * 2 + g.cram.length, 0) : 0
  const progress = answered / Math.max(1, answered + remaining + laterGroups + (item ? 1 : 0))
  const mm = Math.floor(elapsed / 60000)
  const ss = String(Math.floor(elapsed / 1000) % 60).padStart(2, '0')
  const groupWords = ctx?.groups[groupIndex]
    ? [...new Set(ctx.groups[groupIndex].fresh.map((c) => c.noteId))].map((id) => ctx.notes.get(id)).filter((n): n is Note => !!n).map((n) => ({ term: n.term, translation: n.translation, emoji: n.emoji }))
    : []

  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-[680px] items-center gap-3 px-4 py-3">
          <button onClick={() => go('/')} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg" aria-label="Session beenden (Esc)" title="Beenden (Esc) – alles ist gespeichert">
            <IconX />
          </button>
          <div className="flex-1">
            <Progress value={finished ? 1 : progress} label="Fortschritt der Session" />
            {ctx && ctx.groups.length > 1 && !finished && <p className="mt-1 text-center text-[11px] font-medium text-muted tabular">Gruppe {groupIndex + 1} von {ctx.groups.length}</p>}
          </div>
          <span className="w-12 shrink-0 text-right text-sm text-muted tabular" aria-label="Zeit">{mm}:{ss}</span>
          {!finished && ctx && ctx.total > 0 && (
            <button type="button" onClick={togglePause} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg" aria-label="Pause (P)" title="Pause (P)" aria-pressed={paused}>
              <IconPause />
            </button>
          )}
          <FullscreenButton />
        </div>
      </header>

      {paused && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-bg/85 px-6 backdrop-blur-xl" role="dialog" aria-modal="true" aria-label="Pause">
          <div className="text-center">
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-accent-soft text-accent"><IconPause width={34} height={34} /></span>
            <p className="mt-5 text-[28px] font-bold tracking-tight">Pause</p>
            <p className="mt-1 text-[15px] text-muted tabular">Die Uhr steht bei {mm}:{ss}. Alles ist gespeichert.</p>
            <Button variant="primary" size="lg" className="mt-7 min-w-56" onClick={togglePause} kbd="Enter" autoFocus>Weiter lernen</Button>
            <div><Button variant="ghost" className="mt-2" onClick={() => go('/')}>Für heute aufhören</Button></div>
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-[680px] flex-1 flex-col px-4 pb-10 pt-6 desk:pt-10">
        {!ctx ? (
          <div className="h-60" aria-busy="true" />
        ) : finished || (!item && phase !== 'between') ? (
          <SessionEnd answered={answered} right={right} introduced={introduced} empty={ctx.total === 0} drill={ctx.drill} />
        ) : phase === 'between' ? (
          <GroupBreak done={groupIndex + 1} total={ctx.groups.length} words={groupWords} onNext={nextGroup} />
        ) : !face || !note || !deck || !item ? (
          <Empty title="Karte nicht gefunden">Diese Karte wurde gelöscht. <button className="text-accent underline" onClick={() => { const n = engine.current?.next() ?? null; if (n) { setItem(n); resetCard() } else afterGroup() }}>Weiter</button></Empty>
        ) : (
          <>
            <motion.div
              drag={view === 'flip' && revealed && !reduce ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.6}
              onDragEnd={onDragEnd}
              className="w-full"
            >
              <CardShell shake={shake} label={<StepLabel step={phase === 'leech' ? 'review' : item.step} leech={item.card.leech} />}>
                {phase === 'leech' ? (
                  <LeechPause note={note} deck={deck} onSaved={updateNote} onContinue={() => setPhase('ask')} />
                ) : item.step === 'intro' ? (
                  <IntroView key={note.id} note={note} deck={deck} onSaved={updateNote} />
                ) : item.step === 'mc' || item.step === 'dmc' ? (
                  <McView face={face} options={options} picked={picked} onPick={pickMc} />
                ) : view === 'flip' ? (
                  <FlipView face={face} flipped={revealed} />
                ) : view === 'hand' ? (
                  <HandView key={`${item.card.id}-${answered}`} face={face} note={note} revealed={revealed} onReveal={() => setRevealed(true)} />
                ) : (
                  <div>
                    {view === 'listen' ? (
                      <ListenPrompt face={face} />
                    ) : (
                      <>
                        <p className="text-sm font-medium text-muted">{face.promptLabel}</p>
                        <p className="mt-1 break-words text-[32px] font-semibold leading-tight tracking-tight desk:text-[36px]">{face.question}</p>
                      </>
                    )}
                    {phase === 'ask' ? (
                      <div className="mt-6">
                        <AnswerInput value={typed} onChange={setTyped} onSubmit={check} lang={face.answerLang} showAccents={face.answerLang === 'fr'} placeholder="Antwort tippen …" ariaLabel="Deine Antwort" />
                        {!ctx.drill && <HintBar key={item.card.id + answered} steps={hintList} used={hints} onMore={() => setHints((h) => h + 1)} />}
                      </div>
                    ) : (
                      result && (
                        <>
                          <FeedbackView result={result} typed={typed} face={face} strict={deck.strictAccents} />
                          {hints > 0 && isRight(result.verdict) && (
                            <p className="mt-2 text-sm text-muted">Mit {hints === 1 ? 'einem Hinweis' : `${hints} Hinweisen`} – zählt als „{hints === 1 ? 'schwer' : 'nochmal'}“, damit Voki das Wort bald wieder fragt.</p>
                          )}
                        </>
                      )
                    )}
                    {phase !== 'ask' && result && !isRight(result.verdict) && <div className="mt-4"><MemoryAids note={note} /></div>}
                    {phase === 'retype' && result && (
                      <div className="mt-5">
                        <p className="mb-2 text-sm font-medium">Tipp die Lösung einmal ab</p>
                        <AnswerInput value={retype} onChange={setRetype} onSubmit={submitRetype} lang={face.answerLang} showAccents={face.answerLang === 'fr'} placeholder="Lösung abtippen …" ariaLabel="Lösung abtippen" />
                      </div>
                    )}
                  </div>
                )}
              </CardShell>
            </motion.div>

            {/* action row */}
            {phase !== 'leech' && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {item.step === 'intro' && <Button variant="primary" size="lg" className="w-full desk:w-auto" onClick={() => commit(0, true)} kbd="Enter">Weiter</Button>}
                {(item.step === 'mc' || item.step === 'dmc') && picked != null && (
                  <Button variant="primary" size="lg" className="w-full desk:w-auto" onClick={() => commit(0, options[picked] === face.answer)} kbd="Enter">Weiter</Button>
                )}
                {view === 'flip' && typingStep && !revealed && <Button variant="primary" size="lg" className="w-full desk:w-auto" onClick={() => setRevealed(true)} kbd="Leertaste">Umdrehen</Button>}
                {view === 'flip' && typingStep && revealed && (
                  <div className="w-full">
                    <FlipRatings onRate={(r) => commit(r as Grade, r > 1)} />
                    <p className="mt-2 text-center text-xs text-muted">Tipp: Karte nach links wischen = nochmal, nach rechts = gut</p>
                  </div>
                )}
                {view === 'hand' && typingStep && revealed && <div className="w-full"><SelfGradeButtons onGrade={selfGrade} /></div>}
                {(view === 'type' || view === 'listen') && typingStep && phase === 'ask' && (
                  <Button variant="primary" size="lg" className="w-full desk:w-auto" onClick={check} disabled={!typed.trim()} kbd="Enter">Prüfen</Button>
                )}
                {phase === 'feedback' && result && (
                  <>
                    <Button variant="primary" size="lg" className="w-full desk:w-auto" onClick={proceedAfterFeedback} kbd="Enter">{isRight(result.verdict) ? 'Weiter' : 'Abtippen'}</Button>
                    {isRight(result.verdict) && item.step === 'review' && hints === 0 && <Button variant="ghost" onClick={() => commit(Rating.Easy, true, typed)}>War zu leicht</Button>}
                    {!isRight(result.verdict) && (
                      <>
                        <Button variant="ghost" onClick={() => overrideRight(false)}><IconCheck width={16} height={16} /> Ich hatte recht</Button>
                        <Button variant="ghost" className="text-muted" onClick={() => overrideRight(true)}>… und als Lösung speichern</Button>
                      </>
                    )}
                  </>
                )}
                {phase === 'retype' && <Button variant="primary" size="lg" className="w-full desk:w-auto" onClick={submitRetype} disabled={!retype.trim()} kbd="Enter">Weiter</Button>}
              </div>
            )}
            {error && <p role="alert" className="mt-4 rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">{error}</p>}
            <p className="mt-auto hidden pt-10 text-center text-xs text-muted desk:block">
              <Kbd>Enter</Kbd> prüfen/weiter · <Kbd>P</Kbd> Pause · <Kbd>F</Kbd> Vollbild · <Kbd>Leertaste</Kbd> umdrehen · <Kbd>1</Kbd>–<Kbd>4</Kbd> wählen · <Kbd>Ctrl</Kbd>+<Kbd>Leertaste</Kbd> Audio · <Kbd>Alt</Kbd>+Buchstabe Akzent · <Kbd>Esc</Kbd> beenden
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function SessionEnd({ answered, right, introduced, empty, drill }: { answered: number; right: number; introduced: number; empty: boolean; drill: boolean }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Enter' && !(e.target instanceof HTMLButtonElement) && go('/')
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
  if (empty)
    return (
      <div className="rounded-[26px] bg-surface p-8 text-center shadow-card">
        <div className="flex justify-center"><Illustration kind={drill ? 'notebook' : 'done'} /></div>
        <h1 className="mt-4 text-[22px] font-semibold tracking-tight">{drill ? 'Fehlerheft ist leer' : 'Gerade nichts zu lernen'}</h1>
        <p className="mt-1 text-[15px] text-muted">{drill ? 'Keine wackligen Wörter. Stark!' : 'Keine fälligen Wiederholungen und keine neuen Wörter. Morgen geht’s weiter.'}</p>
        <Button variant="primary" className="mt-6" onClick={() => go('/')}>Zur Übersicht</Button>
      </div>
    )
  const rate = answered ? Math.round((right / answered) * 100) : 0
  return (
    <div className="rounded-[26px] bg-surface p-8 text-center shadow-card">
      <div className="flex justify-center"><Illustration kind="done" /></div>
      <h1 className="mt-4 text-[26px] font-semibold tracking-tight">{rate >= 80 ? 'Stark gemacht' : 'Geschafft'}</h1>
      <p className="mt-1 text-[15px] text-muted">Alles ist gespeichert{navigator.onLine ? ' und wird synchronisiert' : ''}.</p>
      <dl className="mx-auto mt-6 grid max-w-sm grid-cols-3 gap-3">
        <div><dt className="text-xs text-muted">Abgefragt</dt><dd className="text-[22px] font-semibold tabular">{answered}</dd></div>
        <div><dt className="text-xs text-muted">Richtig</dt><dd className={cx('text-[22px] font-semibold tabular', rate >= 80 ? 'text-good' : rate >= 60 ? 'text-warn' : 'text-bad')}>{rate} %</dd></div>
        <div><dt className="text-xs text-muted">Neue Wörter</dt><dd className="text-[22px] font-semibold tabular">{introduced}</dd></div>
      </dl>
      <div className="mt-8 flex flex-col gap-2 desk:flex-row desk:justify-center">
        <Button variant="primary" size="lg" onClick={() => go('/')} kbd="Enter">Zur Übersicht</Button>
        <Button size="lg" onClick={() => go('/lernen')}>Noch eine Runde</Button>
      </div>
    </div>
  )
}
