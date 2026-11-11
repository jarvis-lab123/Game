import type { Card } from './types'
import { daysUntil, examDay } from './exam'
import { retrievabilityAt } from './srs'

export const MAX_IN_FLIGHT = 4
export const BACKLOG_LIMIT = 150
export const REVIEWS_BETWEEN_NEW = 3
export const BOOST_DAYS = 3
export const BOOST_THRESHOLD = 0.85

export type Step = 'intro' | 'mc' | 'type' | 'review' | 'cram' | 'practice'
export interface Item { step: Step; card: Card }

interface Pending { step: Step; card: Card; readyAt: number }

export function endOfDay(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - 1
}

export function isDue(c: Card, now: Date): boolean {
  return c.stage === 'review' && !c.suspended && c.due <= endOfDay(now)
}

/**
 * Orders one study session (§5.1, §5.2):
 * due reviews first, new words scattered in (one after every 3 reviews),
 * at most 4 new words on the ladder at once, wrong answers come back 3–5 items later.
 */
export class SessionEngine {
  private reviews: Card[]
  private cram: Card[]
  private fresh: Card[]
  private pending: Pending[] = []
  private turn = 0
  private reviewsSinceNew = 0
  private rng: () => number

  constructor(o: { reviews: Card[]; fresh: Card[]; cram: Card[]; rng?: () => number }) {
    this.reviews = [...o.reviews]
    this.fresh = [...o.fresh]
    this.cram = [...o.cram]
    this.rng = o.rng ?? Math.random
  }

  private ladderCount(): number {
    return new Set(this.pending.filter((p) => p.step !== 'practice').map((p) => p.card.id)).size
  }

  private takePending(onlyReady: boolean): Item | null {
    const list = [...this.pending].sort((a, b) => a.readyAt - b.readyAt)
    const p = list.find((x) => !onlyReady || x.readyAt <= this.turn)
    if (!p) return null
    this.pending.splice(this.pending.indexOf(p), 1)
    return { step: p.step, card: p.card }
  }

  next(): Item | null {
    const ready = this.takePending(true)
    if (ready) return ready
    const canIntro = this.fresh.length > 0 && this.ladderCount() < MAX_IN_FLIGHT
    if (canIntro && (this.reviews.length === 0 || this.reviewsSinceNew >= REVIEWS_BETWEEN_NEW)) {
      const card = this.fresh.shift()!
      this.reviewsSinceNew = 0
      const step: Step = card.stage === 'mc' ? 'mc' : card.stage === 'type' ? 'type' : 'intro'
      return { step, card }
    }
    if (this.reviews.length) return { step: 'review', card: this.reviews.shift()! }
    if (this.cram.length) return { step: 'cram', card: this.cram.shift()! }
    return this.takePending(false)
  }

  private offset(): number {
    return 3 + Math.floor(this.rng() * 3) // 3..5
  }

  private push(step: Step, card: Card, gap: number) {
    this.pending.push({ step, card, readyAt: this.turn + gap - 1 })
  }

  /** Report the outcome; pass the updated card (new stage) so later steps use it. */
  answer(item: Item, ok: boolean, updated: Card = item.card): void {
    this.turn++
    const c = updated
    switch (item.step) {
      case 'intro':
        this.push('mc', c, 2)
        break
      case 'mc':
        this.push(ok ? 'type' : 'mc', c, ok ? 2 : this.offset())
        break
      case 'type':
        if (!ok) this.push('type', c, this.offset())
        break
      case 'review':
      case 'cram':
        this.reviewsSinceNew++
        if (!ok) this.push('practice', c, this.offset())
        break
      case 'practice':
        if (!ok) this.push('practice', c, this.offset())
        break
    }
  }

  /** Items still waiting (for "Fertig?" checks and the progress bar). */
  remaining(): number {
    return this.reviews.length + this.fresh.length + this.cram.length + this.pending.length
  }

  /** Stop introducing new material (time is up); in-flight items still finish. */
  wrapUp(): void {
    this.fresh = []
    this.reviews = []
    this.cram = []
  }
}

/** §5.1 daily budget for new cards. examNeed overrides default and backlog brake. */
export function newBudget(o: { dueCount: number; defaultLimit: number; introducedToday: number; examNeed: number | null }): number {
  if (o.examNeed != null) return Math.max(0, o.examNeed - o.introducedToday)
  if (o.dueCount > BACKLOG_LIMIT) return 0
  return Math.max(0, o.defaultLimit - o.introducedToday)
}

const SEC_PER_REVIEW = 10
const SEC_PER_NEW = 45

export function estimateMinutes(reviews: number, news: number): number {
  return Math.ceil((reviews * SEC_PER_REVIEW + news * SEC_PER_NEW) / 60)
}

/** §6.3 pre-exam boost: not-yet-due learned cards whose recall on exam day is below 85 %. */
export function boostCandidates(cards: Card[], examDate: string, now: Date, retention: number, reviewedToday: Set<string>): Card[] {
  const d = daysUntil(examDate, now)
  if (d < 0 || d > BOOST_DAYS) return []
  const at = examDay(examDate)
  return cards
    .filter((c) => c.stage === 'review' && !c.suspended && !isDue(c, now) && !reviewedToday.has(c.id))
    .map((c) => ({ c, r: retrievabilityAt(c, at, retention) }))
    .filter((x) => x.r < BOOST_THRESHOLD)
    .sort((a, b) => a.r - b.r)
    .map((x) => x.c)
}
