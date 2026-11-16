import type { Card, ReviewLog } from './types'
import { retrievabilityAt } from './srs'

export type Mastery = 'neu' | 'lernt' | 'wackelt' | 'sitzt'
export const MASTERY_LABEL: Record<Mastery, string> = { neu: 'neu', lernt: 'lernt', wackelt: 'wackelt', sitzt: 'sitzt' }

export const SITZT_STABILITY_DAYS = 7
export const WACKELT_RECALL = 0.8

/**
 * "Sitzt das?" for one word (all its cards).
 * @param recent answers for this word, newest first (true = right)
 */
export function noteMastery(cards: Card[], recent: boolean[], now: Date, retention: number): Mastery {
  const live = cards.filter((c) => !c.suspended)
  if (live.length === 0 || live.every((c) => c.stage === 'new')) return 'neu'
  if (live.some((c) => c.leech)) return 'wackelt'
  const last5 = recent.slice(0, 5)
  if (last5.filter((r) => !r).length >= 2) return 'wackelt'
  const learned = live.filter((c) => c.stage === 'review')
  if (learned.some((c) => retrievabilityAt(c, now, retention) < WACKELT_RECALL)) return 'wackelt'
  if (learned.length < live.length) return 'lernt'
  const stable = learned.every((c) => c.fsrs.stability >= SITZT_STABILITY_DAYS)
  const lastTwoRight = recent.length >= 2 && recent[0] && recent[1]
  return stable && lastTwoRight ? 'sitzt' : 'lernt'
}

/** Recent answers per note (newest first) from review logs. */
export function recentByNote(logs: ReviewLog[], noteOf: (cardId: string) => string | undefined): Map<string, boolean[]> {
  const m = new Map<string, boolean[]>()
  const sorted = [...logs].filter((l) => l.mode !== 'intro').sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
  for (const l of sorted) {
    const n = noteOf(l.cardId)
    if (!n) continue
    const arr = m.get(n) ?? []
    if (arr.length < 5) arr.push(l.correct)
    m.set(n, arr)
  }
  return m
}
