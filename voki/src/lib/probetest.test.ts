import { describe, it, expect } from 'vitest'
import { swissGrade, pickTestCards } from './probetest'
import { mkCard } from './testutil'

describe('swissGrade (§6.4)', () => {
  it('6 at 100 %, 4 at 60 %, 1 at 0 %', () => {
    expect(swissGrade(20, 20)).toBe(6)
    expect(swissGrade(12, 20)).toBe(4)
    expect(swissGrade(0, 20)).toBe(1)
  })
  it('rounds to halves', () => {
    expect(swissGrade(17, 20)).toBe(5.5) // 5.25 → 5.5
    expect(swissGrade(13, 20)).toBe(4.5) // 4.25 → 4.5
  })
  it('handles an empty test', () => expect(swissGrade(0, 0)).toBe(1))
})

describe('pickTestCards', () => {
  it('takes 20 random cards, all if fewer, never suspended', () => {
    const cs = Array.from({ length: 30 }, () => mkCard())
    expect(pickTestCards(cs, 20, () => 0.5)).toHaveLength(20)
    const few = [mkCard(), mkCard(), { ...mkCard(), suspended: true }]
    expect(pickTestCards(few, 20, Math.random)).toHaveLength(2)
  })
})
