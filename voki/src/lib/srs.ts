import { fsrs, generatorParameters, Rating, type FSRS, type Grade } from 'ts-fsrs'
import type { Card } from './types'

export const LEECH_LAPSES = 4
export const MAX_INTERVAL = 365

const cache = new Map<number, FSRS>()

/** ts-fsrs scheduler per §5.6. Short-term steps are off: the learning ladder covers them. */
export function scheduler(retention: number): FSRS {
  let s = cache.get(retention)
  if (!s) {
    s = fsrs(
      generatorParameters({
        request_retention: retention,
        maximum_interval: MAX_INTERVAL,
        enable_fuzz: true,
        enable_short_term: false,
      }),
    )
    cache.set(retention, s)
  }
  return s
}

export function applyReview(card: Card, rating: Grade, now: Date, retention: number): Card {
  const { card: f } = scheduler(retention).next(card.fsrs, now, rating)
  return {
    ...card,
    stage: 'review',
    fsrs: f,
    due: f.due.getTime(),
    leech: card.leech || f.lapses >= LEECH_LAPSES,
    updatedAt: now.toISOString(),
  }
}

export type LadderStep = 'intro' | 'mc' | 'type'

/**
 * Learning ladder §5.2: intro -> mc -> type -> review.
 * Only a correct "type" step creates the first FSRS entry (rating Good, or Hard for accent/typo).
 */
export function advanceLadder(
  card: Card,
  step: LadderStep,
  correct: boolean,
  now: Date,
  retention: number,
  rating: Grade = Rating.Good,
): { card: Card; graduated: boolean } {
  const touched = { ...card, updatedAt: now.toISOString() }
  if (step === 'intro') return { card: { ...touched, stage: 'mc' }, graduated: false }
  if (step === 'mc') return { card: { ...touched, stage: correct ? 'type' : 'mc' }, graduated: false }
  if (!correct) return { card: { ...touched, stage: 'type' }, graduated: false }
  return { card: applyReview(card, rating, now, retention), graduated: true }
}

/** Probability of recall at `date`. Unlearned cards count as 0. */
export function retrievabilityAt(card: Card, date: Date, retention: number): number {
  if (card.stage !== 'review' || !card.fsrs.last_review) return 0
  return scheduler(retention).get_retrievability(card.fsrs, date, false)
}
