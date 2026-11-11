import { describe, it, expect } from 'vitest'
import { Rating } from 'ts-fsrs'
import { daysUntil, newPerDay, needsWarning, readiness, isExamActive, examDay } from './exam'
import { applyReview } from './srs'
import { mkCard } from './testutil'

const now = new Date('2026-11-11T10:00:00')

describe('daysUntil', () => {
  it('counts calendar days', () => {
    expect(daysUntil('2026-11-18', now)).toBe(7)
    expect(daysUntil('2026-11-11', now)).toBe(0)
    expect(daysUntil('2026-11-10', now)).toBe(-1)
  })
  it('ignores time of day', () => {
    expect(daysUntil('2026-11-12', new Date('2026-11-11T23:59:00'))).toBe(1)
  })
})

describe('newPerDay (§6.1)', () => {
  it('190 words, 14 days -> 16 per day', () => {
    expect(newPerDay(190, '2026-11-25', now)).toBe(16)
  })
  it('190 words, 7 days -> 38 per day', () => {
    expect(newPerDay(190, '2026-11-18', now)).toBe(38)
  })
  it('last 2 days: no new words', () => {
    expect(newPerDay(50, '2026-11-13', now)).toBe(0)
    expect(newPerDay(50, '2026-11-12', now)).toBe(0)
    expect(newPerDay(50, '2026-11-11', now)).toBe(0)
  })
  it('past exam or nothing to learn -> 0, never negative', () => {
    expect(newPerDay(50, '2026-11-01', now)).toBe(0)
    expect(newPerDay(0, '2026-11-25', now)).toBe(0)
  })
  it('3 days left -> everything today', () => {
    expect(newPerDay(30, '2026-11-14', now)).toBe(30)
  })
  it('warns above 40 per day', () => {
    expect(needsWarning(41)).toBe(true)
    expect(needsWarning(40)).toBe(false)
  })
})

describe('isExamActive', () => {
  it('active until and including exam day', () => {
    expect(isExamActive({ examDate: '2026-11-11' }, now)).toBe(true)
    expect(isExamActive({ examDate: '2026-11-10' }, now)).toBe(false)
    expect(isExamActive({}, now)).toBe(false)
  })
})

describe('readiness (§6.2)', () => {
  it('averages retrievability on exam day per direction; unlearned count 0', () => {
    const learned = applyReview(mkCard({ stage: 'type', direction: 'toNative' }), Rating.Good, now, 0.9)
    const unlearned = mkCard({ direction: 'toNative' })
    const writing = mkCard({ direction: 'toTarget' })
    const r = readiness([learned, unlearned, writing], '2026-11-12', 0.9)
    expect(r.toNative).toBeGreaterThan(0.4)
    expect(r.toNative).toBeLessThan(0.51)
    expect(r.toTarget).toBe(0)
    expect(r.overall).toBeCloseTo((r.toNative! * 2 + 0) / 3, 5)
  })
  it('null for a direction without cards', () => {
    expect(readiness([mkCard({ direction: 'toNative' })], '2026-11-12', 0.9).toTarget).toBeNull()
  })
  it('examDay is 08:00 local on the exam date', () => {
    expect(examDay('2026-11-18').getHours()).toBe(8)
  })
})
