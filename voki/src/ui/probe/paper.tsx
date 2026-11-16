import { useEffect, useMemo, useState } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import { confettiParticles } from '../../lib/papertest'
import { cx } from '../components'

/** Paper colours: cream sheet, blue rules, red margin. Dark mode dims the sheet a little, ink stays dark. */
export const PAPER_VARS =
  '[--paper:#fffdf7] [--paper-back:#f1ede1] [--rule:#c3d6f1] [--margin:#f1a7ad] [--ink:#1d2433] [--ink-2:#5d6474] [--ink-blue:#1e4fc2] [--ink-good:#1e7f3c] [--ink-bad:#cf1028] [--hl:rgba(255,204,0,0.2)] ' +
  'dark:[--paper:#d9d4c5] dark:[--paper-back:#a9a497] dark:[--rule:#9fb5d6] dark:[--margin:#d48a91] dark:[--ink-2:#4b5161] dark:[--hl:rgba(255,204,0,0.26)]'

/** 32 px ruled lines. Text inside uses leading-[32px] so it sits on the rules. */
export const RULED = { backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, var(--rule) 31px, var(--rule) 32px)' }

/** Smoothly counting integer (springs to the new value). */
export function Counter({ value, reduce, className }: { value: number; reduce: boolean; className?: string }) {
  const mv = useSpring(value, { stiffness: 170, damping: 24 })
  const text = useTransform(mv, (v) => String(Math.round(v)))
  useEffect(() => mv.set(value), [mv, value])
  if (reduce) return <span className={cx('tabular', className)}>{value}</span>
  return <motion.span className={cx('tabular', className)}>{text}</motion.span>
}

/** Hand-drawn tick / cross in ink, stroked in when it mounts. */
export function InkMark({ ok, reduce, size = 30 }: { ok: boolean; reduce: boolean; size?: number }) {
  const t = { duration: 0.32, ease: [0.3, 0.7, 0.3, 1] as const }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={ok ? 'text-[var(--ink-good)]' : 'text-[var(--ink-bad)]'} stroke="currentColor">
      {ok ? (
        <motion.path d="M6 17.5c2.6 2 4.6 4.4 6.4 7.2C16 16 20.6 9.4 27 5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={t} />
      ) : (
        <>
          <motion.path d="M7.5 7c5.6 5.4 11.4 11.6 17 18" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={t} />
          <motion.path d="M25 7.5C19 12.4 13 18.6 7.5 25.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ ...t, delay: 0.18 }} />
        </>
      )}
    </svg>
  )
}

/** Small "+1 Punkt" / "0 Punkte" badge that pops and floats away. */
export function PointBadge({ ok }: { ok: boolean }) {
  return (
    <motion.span
      aria-hidden
      className={cx('pointer-events-none absolute right-1 top-0 z-10 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-bold shadow-[0_4px_14px_rgba(0,0,0,0.16)] tabular', ok ? 'bg-good text-white dark:text-black' : 'bg-[#8e8e93] text-white')}
      initial={{ opacity: 0, y: 10, scale: 0.5 }}
      animate={{ opacity: [0, 1, 1, 0], y: [10, -6, -22, -44], scale: [0.5, 1.15, 1, 0.96] }}
      transition={{ duration: 1.15, times: [0, 0.22, 0.6, 1], ease: 'easeOut' }}
    >
      {ok ? '+1 Punkt' : '0 Punkte'}
    </motion.span>
  )
}

/** Reveals text letter by letter (instantly with reduced motion or when `full`). */
export function Typewriter({ text, full, reduce, lang, className }: { text: string; full: boolean; reduce: boolean; lang?: string; className?: string }) {
  const [shown, setShown] = useState(reduce || full ? text.length : 0)
  useEffect(() => {
    if (reduce || full) return setShown(text.length)
    setShown(0)
    const step = Math.max(16, Math.min(48, 650 / Math.max(1, text.length)))
    let k = 0
    let iv: ReturnType<typeof setInterval> | undefined
    const start = setTimeout(() => {
      iv = setInterval(() => {
        k++
        setShown(k)
        if (k >= text.length && iv) clearInterval(iv)
      }, step)
    }, 260)
    return () => {
      clearTimeout(start)
      if (iv) clearInterval(iv)
    }
  }, [text, full, reduce])
  const done = shown >= text.length
  return (
    <span className={className} lang={lang} aria-label={text}>
      <span aria-hidden>{text.slice(0, shown)}</span>
      {!done && <span aria-hidden className="ml-px inline-block h-[0.9em] w-[2px] translate-y-[2px] animate-pulse bg-[var(--ink-blue)]" />}
      <span aria-hidden className="invisible">{text.slice(shown)}</span>
    </span>
  )
}

/** Light confetti burst (~40 particles, ~1.2 s) made with framer-motion. */
export function Confetti({ n = 40 }: { n?: number }) {
  const parts = useMemo(() => confettiParticles(n), [n])
  const color = { accent: 'var(--accent)', good: 'var(--good)', warn: 'var(--warn)' }
  return (
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-0 w-0">
      {parts.map((p, k) => (
        <motion.span
          key={k}
          className="absolute block"
          style={{ width: p.size, height: p.shape === 'rect' ? p.size * 0.55 : p.size, borderRadius: p.shape === 'circle' ? 999 : 2, background: color[p.color], left: -p.size / 2, top: -p.size / 2 }}
          initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
          animate={{ x: [0, p.dx * 0.7, p.dx], y: [0, p.peak, p.dy], opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: 1.25, delay: p.delay, times: [0, 0.32, 1], ease: ['easeOut', 'easeIn'] }}
        />
      ))}
    </div>
  )
}

/** Mini ruled paper with a pencil scribble: "write it on your sheet". */
export function PaperHint({ number, reduce, className }: { number: number; reduce: boolean; className?: string }) {
  return (
    <div className={cx(PAPER_VARS, 'relative overflow-hidden rounded-2xl bg-[var(--paper)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]', className)} style={RULED}>
      <span className="absolute inset-y-0 left-[46px] w-[1.5px] bg-[var(--margin)]" aria-hidden />
      <div className="flex h-8 items-start">
        <span className="w-[38px] text-right text-[15px] font-semibold leading-[30px] text-[var(--ink)] tabular" aria-hidden>{number}.</span>
        <svg key={number} width="120" height="30" viewBox="0 0 120 30" className="ml-4 shrink-0 text-[var(--ink-blue)]" aria-hidden fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <motion.path d="M4 22c6-8 9-12 12-6s4 7 8 0 6-9 9-3 5 8 9 1 7-6 10 0 5 6 9 0 6-5 9 1 5 5 8 0" initial={reduce ? false : { pathLength: 0, opacity: 0.4 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.7, ease: 'easeInOut', delay: 0.15 }} />
        </svg>
      </div>
      <p className="flex h-8 items-center pl-[56px] pr-3 text-[13px] font-medium text-[var(--ink-2)]">
        <IconPencil className="mr-1.5 shrink-0" />Schreib die Übersetzung auf dein Blatt
      </p>
    </div>
  )
}

export function IconPencil({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4 20l1-4.5L16 4.5a2.1 2.1 0 0 1 3 3L8 18.5z" />
      <path d="M14 7l3 3" />
    </svg>
  )
}

export function IconUndo({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  )
}
