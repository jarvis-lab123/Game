import { swissGrade } from './probetest'

/** One self-check on paper: true = right (1 point), false = wrong (0), null = not decided yet. */
export type Decision = boolean | null

/** Points and Swiss grade of the decided items (undecided ones don't count). */
export function paperScore(decisions: Decision[]): { points: number; total: number; grade: number } {
  const decided = decisions.filter((d): d is boolean => d != null)
  const points = decided.filter(Boolean).length
  return { points, total: decided.length, grade: swissGrade(points, decided.length) }
}

/** Grade values for a rolling counter: half steps from → to (inclusive), thinned evenly to ≤ steps + 1 values. */
export function rollSteps(from: number, to: number, steps: number): number[] {
  const a = Math.round(from * 2)
  const b = Math.round(to * 2)
  const dir = b >= a ? 1 : -1
  const all: number[] = []
  for (let v = a; dir > 0 ? v <= b : v >= b; v += dir) all.push(v / 2)
  const max = Math.max(1, Math.floor(steps)) + 1
  if (all.length <= max) return all
  const out: number[] = []
  for (let i = 0; i < max; i++) {
    const v = all[Math.round((i * (all.length - 1)) / (max - 1))]
    if (out[out.length - 1] !== v) out.push(v)
  }
  return out
}

/** First undecided index at or after `from` (wrapping around); -1 if all are decided. */
export function nextOpen(decisions: Decision[], from: number): number {
  const n = decisions.length
  for (let k = 0; k < n; k++) {
    const i = (from + k) % n
    if (decisions[i] == null) return i
  }
  return -1
}

export function gradeTone(grade: number): 'good' | 'warn' | 'bad' {
  return grade >= 5 ? 'good' : grade >= 4 ? 'warn' : 'bad'
}

export interface Particle {
  /** horizontal drift in px */
  dx: number
  /** highest point (negative = upwards) in px */
  peak: number
  /** final vertical offset in px (positive = falls below the start) */
  dy: number
  rotate: number
  size: number
  delay: number
  shape: 'rect' | 'circle'
  color: 'accent' | 'good' | 'warn'
}

/** Confetti burst: particles fly up and out, then fall. Deterministic for a given rng. */
export function confettiParticles(n: number, rng: () => number = Math.random): Particle[] {
  const colors = ['accent', 'good', 'warn'] as const
  return Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + (rng() - 0.5) * Math.PI * 1.1
    const speed = 110 + rng() * 150
    const peak = Math.min(-30, Math.sin(angle) * speed)
    return {
      dx: Math.cos(angle) * speed * 1.4,
      peak,
      dy: 60 + rng() * 140,
      rotate: (rng() - 0.5) * 720,
      size: 5 + rng() * 5,
      delay: rng() * 0.25,
      shape: i % 3 === 0 ? 'circle' : 'rect',
      color: colors[i % colors.length],
    }
  })
}

export interface MergeItem { cardId: string; question: string; answer: string; cardIds?: string[] }

/**
 * Same German word, different French words (e.g. „Metzger(in)“ = boucher / charcutier):
 * asked once, and both French words have to be written.
 */
export function mergeSameGerman<T extends MergeItem>(items: T[]): T[] {
  const key = (q: string) => q.trim().toLowerCase().replace(/\s+/g, ' ')
  const out: T[] = []
  const at = new Map<string, number>()
  for (const it of items) {
    const k = key(it.question)
    const i = at.get(k)
    if (i == null) { at.set(k, out.length); out.push({ ...it }); continue }
    const first = out[i]
    out[i] = { ...first, answer: `${first.answer}  +  ${it.answer}`, cardIds: [...(first.cardIds ?? []), it.cardId, ...(it.cardIds ?? [])] }
  }
  return out
}
