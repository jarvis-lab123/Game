import { describe, it, expect } from 'vitest'
import { State } from 'ts-fsrs'
import { noteMastery } from './mastery'
import { mkCard } from './testutil'

const now = new Date('2026-11-16T10:00:00')
function learned(stability: number, daysAgo = 1, extra: Partial<ReturnType<typeof mkCard>> = {}) {
  const c = mkCard({ stage: 'review', ...extra })
  const last = new Date(now.getTime() - daysAgo * 86400000)
  c.fsrs = { ...c.fsrs, state: State.Review, stability, difficulty: 5, reps: 3, last_review: last, due: new Date(last.getTime() + stability * 86400000) }
  return c
}

describe('noteMastery – "sitzt / sitzt nicht"', () => {
  it('neu when nothing was started', () => {
    expect(noteMastery([mkCard()], [], now, 0.9)).toBe('neu')
  })
  it('lernt while on the ladder', () => {
    expect(noteMastery([mkCard({ stage: 'mc' })], [], now, 0.9)).toBe('lernt')
  })
  it('sitzt: stable (>= 7 days) and the last two answers were right', () => {
    expect(noteMastery([learned(12)], [true, true], now, 0.9)).toBe('sitzt')
  })
  it('not sitzt yet when stability is short', () => {
    expect(noteMastery([learned(3)], [true, true], now, 0.9)).toBe('lernt')
  })
  it('wackelt after 2 errors in the last 5 answers', () => {
    expect(noteMastery([learned(12)], [true, false, true, false], now, 0.9)).toBe('wackelt')
  })
  it('wackelt when recall today is below 80 %', () => {
    expect(noteMastery([learned(2, 9)], [true, true], now, 0.9)).toBe('wackelt')
  })
  it('wackelt for a leech', () => {
    expect(noteMastery([learned(12, 1, { leech: true })], [true, true], now, 0.9)).toBe('wackelt')
  })
  it('both directions must sit', () => {
    expect(noteMastery([learned(12), learned(2)], [true, true], now, 0.9)).toBe('lernt')
  })
})
