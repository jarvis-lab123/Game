import type { Card, ReviewLog, ReviewMode } from './types'

export interface DayCount { date: string; count: number }

/** Local calendar date as YYYY-MM-DD. */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Local day keys from (now - offsetStart) for `days` days; DST-safe (calendar arithmetic). */
function dayRange(now: Date, from: number, days: number): string[] {
  return Array.from({ length: days }, (_, i) => dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + from + i)))
}

/** Reviews per local day for the last `days` days (oldest → newest, zero-filled). */
export function activityByDay(logs: ReviewLog[], days: number, now: Date): DayCount[] {
  const keys = dayRange(now, -(days - 1), days)
  const counts = new Map(keys.map((k) => [k, 0]))
  for (const l of logs) {
    const k = dayKey(new Date(l.timestamp))
    const c = counts.get(k)
    if (c !== undefined) counts.set(k, c + 1)
  }
  return keys.map((date) => ({ date, count: counts.get(date)! }))
}

/** Learned cards due per local day for the next `days` days; overdue counts on day 0. */
export function dueForecast(cards: Card[], days: number, now: Date): DayCount[] {
  const keys = dayRange(now, 0, days)
  const counts = new Map(keys.map((k) => [k, 0]))
  const today = keys[0]
  for (const c of cards) {
    if (c.stage !== 'review' || c.suspended) continue
    let k = dayKey(new Date(c.due))
    if (k < today) k = today
    const v = counts.get(k)
    if (v !== undefined) counts.set(k, v + 1)
  }
  return keys.map((date) => ({ date, count: counts.get(date)! }))
}

/** Modes where the answer is a real recall attempt. */
export const GRADED_MODES: ReviewMode[] = ['type', 'flip', 'hand', 'listen', 'mc']

export interface Accuracy { toTarget: number | null; toNative: number | null; total: number | null; n: number }

/** Share of correct answers among graded logs, split by card direction. */
export function accuracy(
  logs: ReviewLog[],
  dirOf: (cardId: string) => Card['direction'] | undefined,
  filter?: { deckId?: string },
): Accuracy {
  const t = { toTarget: [0, 0], toNative: [0, 0], total: [0, 0] }
  for (const l of logs) {
    if (!GRADED_MODES.includes(l.mode)) continue
    if (filter?.deckId && l.deckId !== filter.deckId) continue
    const ok = l.correct ? 1 : 0
    t.total[0] += ok
    t.total[1]++
    const d = dirOf(l.cardId)
    if (d) {
      t[d][0] += ok
      t[d][1]++
    }
  }
  const r = ([c, n]: number[]) => (n ? c / n : null)
  return { toTarget: r(t.toTarget), toNative: r(t.toNative), total: r(t.total), n: t.total[1] }
}

/** Words (notes) with at least one card in long-term review. */
export function learnedWords(cards: Card[]): number {
  return new Set(cards.filter((c) => c.stage === 'review').map((c) => c.noteId)).size
}
