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

describe('drill (Fehlerheft: MC → Tippen, §5.7)', () => {
  it('asks each drill word as multiple choice, then typing', () => {
    const d = { ...reviewCard(), id: 'd' }
    const e = new SessionEngine({ reviews: [], fresh: [], cram: [], drill: [d], rng })
    expect(run(e)).toEqual(['dmc:d', 'practice:d'])
  })
  it('a wrong drill typing answer comes back', () => {
    const d = { ...reviewCard(), id: 'd' }
    const e = new SessionEngine({ reviews: [], fresh: [], cram: [], drill: [d], rng })
    let failedOnce = false
    const seen = run(e, (step) => step === 'practice' && !failedOnce && (failedOnce = true))
    expect(seen).toEqual(['dmc:d', 'practice:d', 'practice:d'])
  })
})

describe('crunch mode (Not-Modus)', () => {
  const yes = () => true
  it('walks a new word intro -> mc -> cloze -> type and back once as recheck', () => {
    const c = mkCard({ id: 'x' })
    const e = new SessionEngine({ reviews: [], fresh: [c], cram: [], rng, crunch: true, hasCloze: yes })
    expect(run(e)).toEqual(['intro:x', 'mc:x', 'cloze:x', 'type:x', 'recheck:x'])
  })
  it('skips the cloze when the card cannot make one', () => {
    const c = mkCard({ id: 'x' })
    const e = new SessionEngine({ reviews: [], fresh: [c], cram: [], rng, crunch: true, hasCloze: () => false })
    expect(run(e)).toEqual(['intro:x', 'mc:x', 'type:x', 'recheck:x'])
  })
  it('without hasCloze there is no cloze step', () => {
    const e = new SessionEngine({ reviews: [], fresh: [mkCard({ id: 'x' })], cram: [], rng, crunch: true })
    expect(run(e)).toEqual(['intro:x', 'mc:x', 'type:x', 'recheck:x'])
  })
  it('normal mode never asks cloze or recheck, even with hasCloze', () => {
    const e = new SessionEngine({ reviews: [], fresh: [mkCard({ id: 'x' })], cram: [], rng, hasCloze: yes })
    expect(run(e)).toEqual(['intro:x', 'mc:x', 'type:x'])
  })
  it('the recheck comes about 6 items after the correct type', () => {
    const fresh = Array.from({ length: 8 }, (_, i) => mkCard({ id: `n${i}` }))
    const e = new SessionEngine({ reviews: [], fresh, cram: [], rng, crunch: true, hasCloze: yes })
    const seen = run(e)
    const t = seen.indexOf('type:n0')
    const r = seen.indexOf('recheck:n0')
    expect(r - t).toBeGreaterThanOrEqual(5)
    expect(r - t).toBeLessThanOrEqual(8)
    // every word: exactly one recheck when always right
    for (let i = 0; i < 8; i++) expect(seen.filter((s) => s === `recheck:n${i}`)).toHaveLength(1)
  })
  it('a wrong cloze comes back as cloze 3-5 items later, then type', () => {
    const fresh = Array.from({ length: 5 }, (_, i) => mkCard({ id: `n${i}` }))
    const e = new SessionEngine({ reviews: [], fresh, cram: [], rng, crunch: true, hasCloze: yes })
    let failedOnce = false
    const seen = run(e, (step, id) => step === 'cloze' && id === 'n0' && !failedOnce && (failedOnce = true))
    const a = seen.indexOf('cloze:n0')
    const b = seen.indexOf('cloze:n0', a + 1)
    expect(b - a).toBeGreaterThanOrEqual(3)
    expect(b - a).toBeLessThanOrEqual(6)
    expect(seen.indexOf('type:n0')).toBeGreaterThan(b)
    expect(seen).toContain('recheck:n0')
  })
  it('a wrong type requeues type, then recheck after the right one', () => {
    const e = new SessionEngine({ reviews: [], fresh: [mkCard({ id: 'x' })], cram: [], rng, crunch: true, hasCloze: yes })
    let failedOnce = false
    const seen = run(e, (step) => step === 'type' && !failedOnce && (failedOnce = true))
    expect(seen).toEqual(['intro:x', 'mc:x', 'cloze:x', 'type:x', 'type:x', 'recheck:x'])
  })
  it('a wrong recheck comes back until it is right', () => {
    const e = new SessionEngine({ reviews: [], fresh: [mkCard({ id: 'x' })], cram: [], rng, crunch: true, hasCloze: yes })
    let fails = 0
    const seen = run(e, (step) => step === 'recheck' && fails++ < 2)
    expect(seen).toEqual(['intro:x', 'mc:x', 'cloze:x', 'type:x', 'recheck:x', 'recheck:x', 'recheck:x'])
  })
  it(`keeps at most ${MAX_IN_FLIGHT} new words on the ladder (intro..type) at once`, () => {
    const fresh = Array.from({ length: 12 }, (_, i) => mkCard({ id: `n${i}` }))
    const e = new SessionEngine({ reviews: [], fresh, cram: [], rng, crunch: true, hasCloze: yes })
    const seen = run(e, (_s, _id, i) => i % 7 === 3, 500)
    const active = new Set<string>()
    let maxActive = 0
    const typedOk = new Set<string>()
    let i = 0
    for (const s of seen) {
      const [step, id] = s.split(':')
      if (step === 'intro') active.add(id)
      maxActive = Math.max(maxActive, active.size)
      if (step === 'type' && i % 7 !== 3) {
        active.delete(id)
        typedOk.add(id)
      }
      i++
    }
    expect(maxActive).toBeLessThanOrEqual(MAX_IN_FLIGHT)
    expect(typedOk.size).toBe(12)
    expect(e.remaining()).toBe(0)
  })
  it('due reviews still come first', () => {
    const reviews = Array.from({ length: 4 }, (_, i) => ({ ...reviewCard(), id: `r${i}` }))
    const e = new SessionEngine({ reviews, fresh: [mkCard({ id: 'n' })], cram: [], rng, crunch: true, hasCloze: yes })
    expect(run(e)[0]).toBe('review:r0')
  })
  it('puts the writing direction (toTarget) first among new cards', () => {
    const a = mkCard({ id: 'a-nat', noteId: 'a', direction: 'toNative' })
    const b = mkCard({ id: 'a-tar', noteId: 'a', direction: 'toTarget' })
    const c = mkCard({ id: 'c-nat', noteId: 'c', direction: 'toNative' })
    const e = new SessionEngine({ reviews: [], fresh: [a, b, c], cram: [], rng, crunch: true })
    expect(e.next()).toMatchObject({ step: 'intro', card: { id: 'a-tar' } })
  })
  it('normal mode keeps the given fresh order', () => {
    const a = mkCard({ id: 'a-nat', noteId: 'a', direction: 'toNative' })
    const b = mkCard({ id: 'a-tar', noteId: 'a', direction: 'toTarget' })
    const e = new SessionEngine({ reviews: [], fresh: [a, b], cram: [], rng })
    expect(e.next()).toMatchObject({ card: { id: 'a-nat' } })
  })
  it('a resumed mc card goes on to cloze', () => {
    const e = new SessionEngine({ reviews: [], fresh: [mkCard({ id: 'm', stage: 'mc' })], cram: [], rng, crunch: true, hasCloze: yes })
    expect(run(e)).toEqual(['mc:m', 'cloze:m', 'type:m', 'recheck:m'])
  })
  it('wrapUp still lets pending rechecks finish', () => {
    const e = new SessionEngine({ reviews: [], fresh: [mkCard({ id: 'x' }), mkCard({ id: 'y' })], cram: [], rng, crunch: true, hasCloze: yes })
    const seen: string[] = []
    for (let k = 0; k < 4; k++) {
      const it = e.next()!
      seen.push(`${it.step}:${it.card.id}`)
      e.answer(it, true)
    }
    e.wrapUp()
    const rest = run(e)
    expect(rest.filter((s) => s.startsWith('recheck:'))).not.toHaveLength(0)
    expect(e.remaining()).toBe(0)
  })
})
