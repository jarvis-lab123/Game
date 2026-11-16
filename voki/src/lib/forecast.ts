import type { Mastery } from './mastery'
import type { Card, ReviewLog } from './types'

export interface Pace { secPerAnswer: number; accuracy: number; samples: number }

export const DEFAULT_PACE = { secPerAnswer: 12, accuracy: 0.8 }
const PACE_WINDOW = 300
const MIN_SAMPLES = 20

/** From the learner's own logs (ignore mode 'intro' and logs without a measured time, e.g. paper tests): median durationMs of the last 300 answers, clamped 3..60 s; accuracy = share correct. Fewer than 20 samples → defaults secPerAnswer 12, accuracy 0.8 (samples still reported). */
export function personalPace(logs: ReviewLog[]): Pace {
  const recent = logs
    .filter((l) => l.mode !== 'intro' && l.durationMs > 0)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0))
    .slice(0, PACE_WINDOW)
  const samples = recent.length
  if (samples < MIN_SAMPLES) return { ...DEFAULT_PACE, samples }
  const ms = recent.map((l) => l.durationMs).sort((a, b) => a - b)
  const mid = Math.floor(samples / 2)
  const median = samples % 2 ? ms[mid] : (ms[mid - 1] + ms[mid]) / 2
  const secPerAnswer = Math.min(60, Math.max(3, median / 1000))
  const accuracy = recent.filter((l) => l.correct).length / samples
  return { secPerAnswer, accuracy, samples }
}

function cardEffort(c: Card, m: Mastery | undefined): number {
  if (c.stage === 'new' || c.stage === 'intro') return 5
  if (c.stage === 'mc' || c.stage === 'type') return 4
  return m === 'sitzt' ? 0 : 2
}

/** Answers still needed until every word "sitzt", per card: new 5, on ladder (mc/type) 4, review but not sitzt 2, sitzt 0 — each divided by max(accuracy, 0.3). Suspended cards ignored. masteryOf(noteId). Returns rounded answers and minutes = answers*secPerAnswer/60 rounded up. */
export function remainingEffort(cards: Card[], masteryOf: (noteId: string) => Mastery | undefined, pace: Pace): { answers: number; minutes: number } {
  const acc = Math.max(pace.accuracy, 0.3)
  let raw = 0
  for (const c of cards) if (!c.suspended) raw += cardEffort(c, masteryOf(c.noteId))
  const answers = Math.round(raw / acc)
  return { answers, minutes: Math.ceil((answers * pace.secPerAnswer) / 60) }
}

/** Days needed at dailyMinutes per day (ceil, min 0). */
export function daysToFinish(minutes: number, dailyMinutes: number): number {
  if (minutes <= 0) return 0
  return Math.ceil(minutes / Math.max(dailyMinutes, 1))
}
