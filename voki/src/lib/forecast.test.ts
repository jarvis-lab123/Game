import { describe, it, expect } from 'vitest'
import { personalPace, remainingEffort, daysToFinish, type Pace } from './forecast'
import { mkCard } from './testutil'
import type { Mastery } from './mastery'
import type { ReviewLog } from './types'

let i = 0
function mkLog(p: Partial<ReviewLog>): ReviewLog {
  i++
  const ts = new Date(Date.UTC(2026, 10, 1, 0, 0, i)).toISOString()
  return { id: `l${i}`, cardId: 'c1', deckId: 'd1', timestamp: ts, mode: 'type', rating: 3, correct: true, durationMs: 8000, ...p }
}

describe('personalPace', () => {
  it('uses defaults with fewer than 20 samples but reports the count', () => {
    const logs = Array.from({ length: 19 }, () => mkLog({ durationMs: 30000, correct: false }))
    expect(personalPace(logs)).toEqual({ secPerAnswer: 12, accuracy: 0.8, samples: 19 })
  })
  it('ignores intro logs', () => {
    const logs = [...Array.from({ length: 10 }, () => mkLog({})), ...Array.from({ length: 30 }, () => mkLog({ mode: 'intro' }))]
    expect(personalPace(logs).samples).toBe(10)
    expect(personalPace(logs).secPerAnswer).toBe(12)
  })
  it('takes the median duration and the share correct', () => {
    const logs = [
      ...Array.from({ length: 15 }, () => mkLog({ durationMs: 6000, correct: true })),
      ...Array.from({ length: 10 }, () => mkLog({ durationMs: 50000, correct: false })),
    ]
    const p = personalPace(logs)
    expect(p.samples).toBe(25)
    expect(p.secPerAnswer).toBe(6)
    expect(p.accuracy).toBeCloseTo(15 / 25)
  })
  it('clamps the median to 3..60 seconds', () => {
    expect(personalPace(Array.from({ length: 20 }, () => mkLog({ durationMs: 500 }))).secPerAnswer).toBe(3)
    expect(personalPace(Array.from({ length: 20 }, () => mkLog({ durationMs: 120000 }))).secPerAnswer).toBe(60)
  })
  it('only looks at the newest 300 answers', () => {
    const old = Array.from({ length: 300 }, () => mkLog({ durationMs: 40000, correct: false }))
    const recent = Array.from({ length: 300 }, () => mkLog({ durationMs: 5000, correct: true }))
    const p = personalPace([...recent, ...old].reverse())
    expect(p.samples).toBe(300)
    expect(p.secPerAnswer).toBe(5)
    expect(p.accuracy).toBe(1)
  })
  it('handles an even number of samples', () => {
    const logs = [...Array.from({ length: 10 }, () => mkLog({ durationMs: 4000 })), ...Array.from({ length: 10 }, () => mkLog({ durationMs: 8000 }))]
    expect(personalPace(logs).secPerAnswer).toBe(6)
  })
})

describe('remainingEffort', () => {
  const pace: Pace = { secPerAnswer: 12, accuracy: 1, samples: 100 }
  it('weights cards by stage and mastery', () => {
    const cards = [
      mkCard({ noteId: 'a', stage: 'new' }), // 5
      mkCard({ noteId: 'b', stage: 'mc' }), // 4
      mkCard({ noteId: 'b', stage: 'type' }), // 4
      mkCard({ noteId: 'c', stage: 'review' }), // lernt → 2
      mkCard({ noteId: 'd', stage: 'review' }), // sitzt → 0
      mkCard({ noteId: 'e', stage: 'intro' }), // treated as new → 5
    ]
    const m: Record<string, Mastery> = { a: 'neu', b: 'lernt', c: 'lernt', d: 'sitzt', e: 'neu' }
    const r = remainingEffort(cards, (id) => m[id], pace)
    expect(r.answers).toBe(20)
    expect(r.minutes).toBe(4) // 20 * 12 / 60
  })
  it('ignores suspended cards', () => {
    const r = remainingEffort([mkCard({ stage: 'new', suspended: true })], () => 'neu', pace)
    expect(r).toEqual({ answers: 0, minutes: 0 })
  })
  it('divides by accuracy (min 0.3) and rounds minutes up', () => {
    const cards = [mkCard({ noteId: 'x', stage: 'review' })]
    expect(remainingEffort(cards, () => 'wackelt', { ...pace, accuracy: 0.5 })).toEqual({ answers: 4, minutes: 1 })
    expect(remainingEffort(cards, () => 'wackelt', { ...pace, accuracy: 0.1 }).answers).toBe(7) // 2/0.3 = 6.67
  })
  it('review cards with unknown mastery still count as not sitzt', () => {
    expect(remainingEffort([mkCard({ stage: 'review' })], () => undefined, pace).answers).toBe(2)
  })
})

describe('daysToFinish', () => {
  it('rounds up and never goes below 0', () => {
    expect(daysToFinish(130, 15)).toBe(9)
    expect(daysToFinish(0, 15)).toBe(0)
    expect(daysToFinish(15, 15)).toBe(1)
    expect(daysToFinish(-5, 15)).toBe(0)
  })
  it('guards a zero goal', () => {
    expect(daysToFinish(30, 0)).toBe(30)
  })
})
