import { describe, it, expect } from 'vitest'
import { Rating, State } from 'ts-fsrs'
import { SessionEngine, newBudget, estimateMinutes, boostCandidates, MAX_IN_FLIGHT, BACKLOG_LIMIT } from './session'
import { applyReview } from './srs'
import { mkCard } from './testutil'

const now = new Date('2026-11-11T10:00:00')
const rng = () => 0 // always shortest requeue offset (3)

function reviewCard(deckId = 'd1') {
  return { ...applyReview(mkCard({ stage: 'type', deckId }), Rating.Good, new Date('2026-11-01T08:00:00'), 0.9) }
}

/** Drive the engine: everything correct unless `fail` says otherwise. */
function run(e: SessionEngine, fail: (step: string, id: string, i: number) => boolean = () => false, max = 200) {
  const seen: string[] = []
  for (let i = 0; i < max; i++) {
    const it = e.next()
    if (!it) break
    seen.push(`${it.step}:${it.card.id}`)
    e.answer(it, !fail(it.step, it.card.id, i))
  }
  return seen
}

describe('SessionEngine', () => {
  it('walks a new card through intro -> mc -> type and then ends', () => {
    const c = mkCard({ id: 'x' })
    const e = new SessionEngine({ reviews: [], fresh: [c], cram: [], rng })
    expect(run(e)).toEqual(['intro:x', 'mc:x', 'type:x'])
  })
  it('requeues a wrong mc answer 3-5 items later', () => {
    const fresh = ['a', 'b', 'c', 'd', 'e'].map((id) => mkCard({ id }))
    const e = new SessionEngine({ reviews: [], fresh, cram: [], rng })
    const seen = run(e, (step, id) => step === 'mc' && id === 'a' && !failed.has('a') && !!failed.add('a'))
    const firstMc = seen.indexOf('mc:a')
    const secondMc = seen.indexOf('mc:a', firstMc + 1)
    expect(secondMc - firstMc).toBeGreaterThanOrEqual(3)
    expect(secondMc - firstMc).toBeLessThanOrEqual(6)
  })
  it(`never has more than ${MAX_IN_FLIGHT} new words in the ladder at once`, () => {
    const fresh = Array.from({ length: 10 }, (_, i) => mkCard({ id: `n${i}` }))
    const e = new SessionEngine({ reviews: [], fresh, cram: [], rng })
    const seen = run(e)
    const active = new Set<string>()
    let maxActive = 0
    for (const s of seen) {
      const [step, id] = s.split(':')
      if (step === 'intro') active.add(id)
      maxActive = Math.max(maxActive, active.size)
      if (step === 'type') active.delete(id)
    }
    expect(maxActive).toBeLessThanOrEqual(MAX_IN_FLIGHT)
    expect(seen.filter((s) => s.startsWith('type:')).length).toBe(10)
  })
  it('puts due reviews first and scatters new cards between them', () => {
    const reviews = Array.from({ length: 6 }, (_, i) => ({ ...reviewCard(), id: `r${i}` }))
    const e = new SessionEngine({ reviews, fresh: [mkCard({ id: 'n' })], cram: [], rng })
    const seen = run(e)
    expect(seen[0]).toBe('review:r0')
    const intro = seen.indexOf('intro:n')
    expect(intro).toBeGreaterThan(0)
    expect(intro).toBeLessThan(5) // not all at the end
  })
  it('a failed review comes back once as practice', () => {
    const r = { ...reviewCard(), id: 'r' }
    const e = new SessionEngine({ reviews: [r], fresh: [], cram: [], rng })
    expect(run(e, (step) => step === 'review')).toEqual(['review:r', 'practice:r'])
  })
  it('cram cards come after due reviews', () => {
    const r = { ...reviewCard(), id: 'r' }
    const k = { ...reviewCard(), id: 'k' }
    const e = new SessionEngine({ reviews: [r], fresh: [], cram: [k], rng })
    expect(run(e)).toEqual(['review:r', 'cram:k'])
  })
  it('resumes in-progress cards at their stage', () => {
    const e = new SessionEngine({ reviews: [], fresh: [mkCard({ id: 'm', stage: 'type' })], cram: [], rng })
    expect(run(e)).toEqual(['type:m'])
  })
})
const failed = new Set<string>()

describe('newBudget (§5.1)', () => {
  it('default limit minus what was introduced today', () => {
    expect(newBudget({ dueCount: 10, defaultLimit: 15, introducedToday: 5, examNeed: null })).toBe(10)
  })
  it(`backlog brake: more than ${BACKLOG_LIMIT} due -> no new cards`, () => {
    expect(newBudget({ dueCount: 151, defaultLimit: 15, introducedToday: 0, examNeed: null })).toBe(0)
  })
  it('exam mode overrides default and the backlog brake', () => {
    expect(newBudget({ dueCount: 200, defaultLimit: 15, introducedToday: 0, examNeed: 38 })).toBe(38)
  })
  it('never negative', () => {
    expect(newBudget({ dueCount: 0, defaultLimit: 15, introducedToday: 30, examNeed: null })).toBe(0)
  })
})

describe('estimateMinutes', () => {
  it('12 reviews + 15 new ~ 14 min', () => {
    expect(estimateMinutes(12, 15)).toBe(14)
  })
  it('0 for nothing', () => {
    expect(estimateMinutes(0, 0)).toBe(0)
  })
})

function mkReview(id: string, stability: number, last: string, due: string) {
  const c = mkCard({ id, stage: 'review' })
  c.fsrs = { ...c.fsrs, state: State.Review, stability, difficulty: 5, reps: 2, last_review: new Date(last), due: new Date(due) }
  c.due = c.fsrs.due.getTime()
  return c
}

describe('boostCandidates (§6.3)', () => {
  const weak = mkReview('weak', 1.5, '2026-11-10T10:00:00', '2026-11-12T10:00:00')
  const strong = mkReview('strong', 40, '2026-11-11T09:00:00', '2026-12-20T10:00:00')
  const dueToday = mkReview('due', 1.5, '2026-11-09T10:00:00', '2026-11-11T09:00:00')
  it('in the last 3 days, picks not-yet-due cards with R(exam) < 0.85', () => {
    const ids = boostCandidates([weak, strong, dueToday], '2026-11-14', now, 0.9, new Set()).map((c) => c.id)
    expect(ids).toEqual(['weak'])
  })
  it('nothing more than 3 days before the exam', () => {
    expect(boostCandidates([weak], '2026-11-20', now, 0.9, new Set())).toEqual([])
  })
  it('skips cards already reviewed today', () => {
    expect(boostCandidates([weak], '2026-11-14', now, 0.9, new Set(['weak']))).toEqual([])
  })
})

describe('SessionEngine.updateCard', () => {
  it('a sibling direction that skipped intro is asked as mc directly', () => {
    const a = mkCard({ id: 'a', noteId: 'n' })
    const b = mkCard({ id: 'b', noteId: 'n', direction: 'toNative' })
    const e = new SessionEngine({ reviews: [], fresh: [a, b], cram: [], rng })
    const first = e.next()!
    expect(first.step).toBe('intro')
    e.answer(first, true, { ...a, stage: 'mc' })
    e.updateCard({ ...b, stage: 'mc' })
    const seen = run(e)
    expect(seen).not.toContain('intro:b')
    expect(seen).toContain('mc:b')
  })
})

describe('wrapUp (review #3)', () => {
  it('reports how many items were dropped', () => {
    const reviews = Array.from({ length: 3 }, (_, i) => ({ ...reviewCard(), id: `w${i}` }))
    const e = new SessionEngine({ reviews, fresh: [mkCard()], cram: [], rng })
    e.next()
    expect(e.wrapUp()).toBe(3)
  })
})
