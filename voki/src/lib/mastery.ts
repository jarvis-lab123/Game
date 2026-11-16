import type { Card, ReviewLog } from './types'
import { retrievabilityAt } from './srs'

export type Mastery = 'neu' | 'lernt' | 'wackelt' | 'sitzt'
export const MASTERY_LABEL: Record<Mastery, string> = { neu: 'neu', lernt: 'lernt', wackelt: 'wackelt', sitzt: 'sitzt' }

export const SITZT_STABILITY_DAYS = 7
export const WACKELT_RECALL = 0.8
/** Test within this many days: „sitzt“ = still known on the test day with ≥ EXAM_RECALL. */
export const EXAM_NEAR_DAYS = 7
export const EXAM_RECALL = 0.85

/**
 * "Sitzt das?" for one word (all its cards).
 * @param recent answers for this word, newest first (true = right)
 * @param examAt if a test is near (≤ 7 days): a word also „sitzt“ when it will most likely still be
 *   known on the test day – otherwise nothing could ever „sitzen“ in the last week before a test.
 */
export function noteMastery(cards: Card[], recent: boolean[], now: Date, retention: number, examAt?: Date): Mastery {
  const live = cards.filter((c) => !c.suspended)
  if (live.length === 0 || live.every((c) => c.stage === 'new')) return 'neu'
  if (live.some((c) => c.leech)) return 'wackelt'
  const last5 = recent.slice(0, 5)
  if (last5.filter((r) => !r).length >= 2) return 'wackelt'
  const learned = live.filter((c) => c.stage === 'review')
  if (learned.some((c) => retrievabilityAt(c, now, retention) < WACKELT_RECALL)) return 'wackelt'
  if (learned.length < live.length) return 'lernt'
  const lastTwoRight = recent.length >= 2 && recent[0] && recent[1]
  if (!lastTwoRight) return 'lernt'
  if (learned.every((c) => c.fsrs.stability >= SITZT_STABILITY_DAYS)) return 'sitzt'
  const soon = examAt && examAt.getTime() >= now.getTime() && examAt.getTime() - now.getTime() <= EXAM_NEAR_DAYS * 86400000
  return soon && learned.every((c) => retrievabilityAt(c, examAt, retention) >= EXAM_RECALL) ? 'sitzt' : 'lernt'
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
