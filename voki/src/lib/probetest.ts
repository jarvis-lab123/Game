import type { Card } from './types'

export const TEST_SIZE = 20

/** Swiss scale, linear: 6 at 100 %, 4 at 60 % (= 1 + 5·p), rounded to halves. */
export function swissGrade(correct: number, total: number): number {
  if (total <= 0) return 1
  const raw = 1 + (5 * correct) / total
  return Math.min(6, Math.max(1, Math.round(raw * 2) / 2))
}

export function pickTestCards(cards: Card[], n = TEST_SIZE, rng: () => number = Math.random): Card[] {
  const pool = cards.filter((c) => !c.suspended)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n)
}

/** Test length from the `?n=` param: '20' | '40' | 'all'. Invalid → TEST_SIZE; always capped at `available`. */
export function testSize(param: string | null, available: number): number {
  const avail = Math.max(0, Math.floor(available))
  if (param === 'all') return avail
  const n = param != null && /^\d+$/.test(param.trim()) ? parseInt(param, 10) : NaN
  return Math.min(avail, Number.isFinite(n) && n > 0 ? n : TEST_SIZE)
}
