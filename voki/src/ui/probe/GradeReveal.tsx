import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, animate, motion } from 'framer-motion'
import type { Deck } from '../../lib/types'
import { gradeTone, paperScore, rollSteps, type Decision } from '../../lib/papertest'
import { Button, Kbd, Ring, cx } from '../components'
import { go } from '../router'
import { Confetti, useCalmFocus } from './paper'
import type { PaperItem } from './PaperTest'

type Stage = 'count' | 'roll' | 'stamp'

const TONE_TEXT = { good: 'text-good', warn: 'text-warn', bad: 'text-bad' }

function message(grade: number) {
  if (grade >= 5.5) return { t: 'Wow, das sitzt!', d: 'So kannst du in den echten Test gehen.' }
  if (grade >= 5) return { t: 'Stark gemacht!', d: 'Noch die paar falschen Wörter üben, dann ist es perfekt.' }
  if (grade >= 4) return { t: 'Genügend – da geht noch mehr', d: 'Die falschen Wörter sind jetzt im Fehlerheft. Üb sie heute noch einmal.' }
  return { t: 'Kein Problem – genau dafür ist der Probetest', d: 'Die falschen Wörter sind jetzt im Fehlerheft. Üb sie und mach dann nochmals einen Probetest.' }
}

/**
 * The finale: points count up and the ring fills, then the grade rolls up from 1.0
 * and lands with a teacher's stamp (plus confetti from 5.0). Click / Enter skips ahead.
 */
export function GradeReveal({ deck, items, decisions, reduce, onAgain }: { deck: Deck; items: PaperItem[]; decisions: Decision[]; reduce: boolean; onAgain: () => void }) {
  const { points, total, grade } = paperScore(decisions)
  const tone = gradeTone(grade)
  const [stage, setStage] = useState<Stage>(reduce ? 'stamp' : 'count')
  const [shownPoints, setShownPoints] = useState(reduce ? points : 0)
  const [shownGrade, setShownGrade] = useState(reduce ? grade : 1)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const [burst, setBurst] = useState(false)

  const finish = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setShownPoints(points)
    setShownGrade(grade)
    setStage('stamp')
  }

  // 1) count points (ring fills along)
  useEffect(() => {
    if (stage !== 'count') return
    const c = animate(0, points, { duration: Math.min(1.6, 0.5 + points * 0.05), ease: [0.2, 0.7, 0.3, 1], onUpdate: (v) => setShownPoints(Math.round(v)) })
    const t = setTimeout(() => setStage('roll'), Math.min(1600, 500 + points * 50) + 300)
    return () => { c.stop(); clearTimeout(t) }
  }, [stage, points])

  // 2) roll the grade 1.0 → final, slowing down at the end
  useEffect(() => {
    if (stage !== 'roll') return
    const steps = rollSteps(1, grade, 10)
    let at = 0
    steps.forEach((v, k) => {
      at += k === 0 ? 0 : 70 + 150 * Math.pow(k / steps.length, 2.2)
      timers.current.push(setTimeout(() => setShownGrade(v), at))
    })
    timers.current.push(setTimeout(() => setStage('stamp'), at + 260))
    return () => { timers.current.forEach(clearTimeout); timers.current = [] }
  }, [stage, grade])

  // confetti from 5.0, removed again once it has fallen
  useEffect(() => {
    if (stage !== 'stamp' || reduce || grade < 5) return
    setBurst(true)
    const t = setTimeout(() => setBurst(false), 1700)
    return () => clearTimeout(t)
  }, [stage, reduce, grade])

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (stage !== 'stamp' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); finish() }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  const stamped = stage === 'stamp'
  const focus = useCalmFocus<HTMLButtonElement>(stamped)
  const wrong = items.map((it, k) => ({ it, d: decisions[k] })).filter((x) => x.d === false).map((x) => x.it)
  const msg = message(grade)
  const pct = total > 0 ? shownPoints / total : 0

  return (
    <div className="space-y-5 overflow-x-clip [overflow-clip-margin:8px]">
      <div
        className={cx('relative rounded-[26px] bg-surface px-6 pb-7 pt-6 text-center shadow-card desk:px-10', !stamped && 'cursor-pointer')}
        onClick={stamped ? undefined : finish}
        title={stamped ? undefined : 'Tippen zum Überspringen'}
      >
        <p className="text-sm font-medium text-muted">{deck.name} · Probetest auf Papier</p>
        <motion.div
          className="mt-6 flex items-center justify-center gap-6 desk:gap-12"
          animate={stamped && !reduce ? { y: [0, 3, 0] } : { y: 0 }}
          transition={{ duration: 0.22, delay: 0.08 }}
        >
          <Ring value={pct} size={128} stroke={11} tone={stamped ? tone : 'accent'} label={`${points} von ${total} Punkten`}>
            <div aria-hidden>
              <p className="text-[34px] font-bold leading-none tracking-tight tabular">{shownPoints}</p>
              <p className="mt-1 text-[12px] font-medium text-muted tabular">von {total} Punkten</p>
            </div>
          </Ring>
          <div className="relative grid h-[132px] w-[132px] shrink-0 place-items-center">
            {burst && <Confetti />}
            <AnimatePresence>
              {stamped && (
                <motion.div
                  key="stamp"
                  aria-hidden
                  className={cx('absolute inset-1 rounded-[22px] border-[3px] border-current p-[3px]', TONE_TEXT[tone])}
                  initial={reduce ? false : { scale: 1.9, opacity: 0, rotate: -18 }}
                  animate={{ scale: 1, opacity: 0.9, rotate: -8 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 17, mass: 0.8 }}
                >
                  <div className="h-full w-full rounded-[16px] border-[1.5px] border-current opacity-70" />
                  <span className="absolute left-1/2 top-[9px] -translate-x-1/2 bg-surface px-1.5 text-[11px] font-bold uppercase tracking-[0.18em]">Note</span>
                </motion.div>
              )}
            </AnimatePresence>
            <motion.div
              className={cx('relative text-[56px] font-bold leading-none tracking-tight tabular', stamped ? TONE_TEXT[tone] : 'text-fg')}
              animate={stamped ? { rotate: -8, scale: reduce ? 1 : [1.3, 1] } : { rotate: 0, scale: 1 }}
              transition={stamped ? { type: 'spring', stiffness: 520, damping: 15 } : { duration: 0 }}
              aria-hidden
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={shownGrade}
                  className="inline-block"
                  initial={reduce ? false : { y: 26, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { y: -26, opacity: 0 }}
                  transition={{ duration: 0.11 }}
                >
                  {shownGrade.toFixed(1)}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          </div>
        </motion.div>

        <p className="sr-only" aria-live="polite">{stamped ? `Note ${grade.toFixed(1)}. ${points} von ${total} Punkten.` : ''}</p>

        <div className="mt-6 min-h-[72px]">
          {stamped ? (
            <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 0.35, duration: 0.3 }}>
              <p className="text-[19px] font-semibold">{msg.t}</p>
              <p className="mx-auto mt-1 max-w-[420px] text-[15px] text-muted">{wrong.length > 0 ? msg.d : 'Alles richtig – nichts für das Fehlerheft.'}</p>
              <p className="mt-3 text-[13px] text-muted">Schweizer Skala: 6 = alles richtig, 4 = 60 %</p>
            </motion.div>
          ) : (
            <p className="pt-2 text-sm text-muted">{stage === 'count' ? 'Punkte zählen …' : 'Note wird ausgerechnet …'}<span className="ml-2 hidden desk:inline"><Kbd>Enter</Kbd> überspringen</span></p>
          )}
        </div>
      </div>

      {stamped && (
        <motion.div className="space-y-5" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 0.6, duration: 0.35 }}>
          {wrong.length > 0 && (
            <div className="rounded-[22px] bg-surface p-5 shadow-card desk:p-6">
              <p className="text-[17px] font-semibold">Das übst du noch <span className="text-muted tabular">· {wrong.length}</span></p>
              <ul className="mt-2 divide-y divide-line">
                {wrong.map((it) => (
                  <li key={it.cardId} className="flex flex-wrap items-baseline gap-x-2 py-2.5">
                    <span className="text-[15px] text-muted">{it.question}</span>
                    <span className="text-muted" aria-hidden>→</span>
                    <span className="sr-only">Lösung:</span>
                    <span className="text-[17px] font-semibold" lang={it.answerLang}>{it.answer}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-col gap-2 desk:flex-row">
            <Button ref={focus} variant="primary" size="lg" onClick={() => go('/ueben')}>Zum Fehlerheft</Button>
            <Button size="lg" onClick={onAgain}>Neuer Probetest</Button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
