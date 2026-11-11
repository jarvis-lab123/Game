import { describe, it, expect } from 'vitest'
import { Rating, State } from 'ts-fsrs'
import { applyReview, advanceLadder, retrievabilityAt, LEECH_LAPSES } from './srs'
import { mkCard } from './testutil'

const now = new Date('2026-11-11T10:00:00')

describe('applyReview', () => {
  it('Good on a graduated card schedules days ahead and sets stage review', () => {
    const c = applyReview(mkCard({ stage: 'type' }), Rating.Good, now, 0.9)
    expect(c.stage).toBe('review')
    expect(c.fsrs.state).toBe(State.Review)
    expect(c.due).toBeGreaterThan(now.getTime() + 20 * 3600 * 1000)
    expect(c.due).toBe(c.fsrs.due.getTime())
  })
  it('marks a card as leech after 4 lapses', () => {
    let c = applyReview(mkCard({ stage: 'type' }), Rating.Good, now, 0.9)
    let t = now.getTime()
    for (let i = 0; i < LEECH_LAPSES; i++) {
      t += 10 * 86400000
      c = applyReview(c, Rating.Good, new Date(t), 0.9)
      t += 10 * 86400000
      c = applyReview(c, Rating.Again, new Date(t), 0.9)
    }
    expect(c.fsrs.lapses).toBe(4)
    expect(c.leech).toBe(true)
  })
})

describe('advanceLadder (§5.2)', () => {
  it('intro -> mc', () => {
    expect(advanceLadder(mkCard(), 'intro', true, now, 0.9).card.stage).toBe('mc')
  })
  it('mc correct -> type, wrong stays mc', () => {
    expect(advanceLadder(mkCard({ stage: 'mc' }), 'mc', true, now, 0.9).card.stage).toBe('type')
    const r = advanceLadder(mkCard({ stage: 'mc' }), 'mc', false, now, 0.9)
    expect(r.card.stage).toBe('mc')
    expect(r.graduated).toBe(false)
  })
  it('type correct graduates into FSRS review', () => {
    const r = advanceLadder(mkCard({ stage: 'type' }), 'type', true, now, 0.9, Rating.Good)
    expect(r.graduated).toBe(true)
    expect(r.card.stage).toBe('review')
    expect(r.card.fsrs.reps).toBe(1)
  })
  it('type wrong stays on type without FSRS entry', () => {
    const r = advanceLadder(mkCard({ stage: 'type' }), 'type', false, now, 0.9)
    expect(r.card.stage).toBe('type')
    expect(r.card.fsrs.reps).toBe(0)
  })
})

describe('retrievabilityAt', () => {
  it('is 0 for unlearned cards', () => {
    expect(retrievabilityAt(mkCard(), now, 0.9)).toBe(0)
  })
  it('is high right after review and decays over time', () => {
    const c = applyReview(mkCard({ stage: 'type' }), Rating.Good, now, 0.9)
    const r1 = retrievabilityAt(c, new Date(now.getTime() + 86400000), 0.9)
    const r30 = retrievabilityAt(c, new Date(now.getTime() + 30 * 86400000), 0.9)
    expect(r1).toBeGreaterThan(0.85)
    expect(r30).toBeLessThan(r1)
  })
})
