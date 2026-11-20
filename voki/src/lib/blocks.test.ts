import { describe, expect, it } from 'vitest'
import { blockDayPlan, blockStates, drillCurrent, drillFinished, drillMark, overallGrade, pickNextBlock, splitBlocks, startDrill } from './blocks'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`)
const noShuffle = () => 0.999999

describe('splitBlocks', () => {
  it('222 words → 4 balanced blocks of ~50', () => {
    const b = splitBlocks(ids(222))
    expect(b.map((x) => x.length)).toEqual([56, 56, 55, 55])
    expect(b.flat()).toEqual(ids(222))
  })
  it('small decks stay one block', () => {
    expect(splitBlocks(ids(30)).map((x) => x.length)).toEqual([30])
    expect(splitBlocks(ids(74)).map((x) => x.length)).toEqual([74])
    expect(splitBlocks(ids(75)).map((x) => x.length)).toEqual([38, 37])
  })
  it('empty → no blocks', () => expect(splitBlocks([])).toEqual([]))
})

describe('blockStates / pickNextBlock', () => {
  it('first ungraded block is next', () => {
    const s = blockStates([50, 50, 50], [{ block: 0, blocks: 3, grade: 5, date: '2026-11-01' }])
    expect(s.map((x) => x.grade)).toEqual([5, null, null])
    expect(pickNextBlock(s)).toEqual({ index: 1, reason: 'neu' })
  })
  it('all graded → worst latest grade, tie → longest ago', () => {
    const s = blockStates([50, 50, 50], [
      { block: 0, blocks: 3, grade: 3, date: '2026-11-01' },
      { block: 0, blocks: 3, grade: 5.5, date: '2026-11-04' },
      { block: 1, blocks: 3, grade: 4, date: '2026-11-03' },
      { block: 2, blocks: 3, grade: 4, date: '2026-11-02' },
    ])
    expect(s[0]).toMatchObject({ grade: 5.5, best: 5.5, attempts: 2 })
    expect(pickNextBlock(s)).toEqual({ index: 2, reason: 'schlechteste' })
  })
  it('below 4 the block is not passed and comes again', () => {
    const s = blockStates([50, 50], [{ block: 0, blocks: 2, grade: 3.5, date: '2026-11-01' }])
    expect(pickNextBlock(s)).toEqual({ index: 0, reason: 'nochmal' })
    const ok = blockStates([50, 50], [{ block: 0, blocks: 2, grade: 4, date: '2026-11-01' }])
    expect(pickNextBlock(ok)).toEqual({ index: 1, reason: 'neu' })
  })
  it('ignores tests from another split and normal probetests', () => {
    const s = blockStates([50, 50], [{ block: 0, blocks: 3, grade: 6, date: '2026-11-01' }, { grade: 6, date: '2026-11-01' }])
    expect(s.map((x) => x.grade)).toEqual([null, null])
  })
  it('overall grade = mean of latest, in halves', () => {
    const s = blockStates([1, 1, 1], [{ block: 0, blocks: 3, grade: 6, date: 'a' }, { block: 1, blocks: 3, grade: 4.5, date: 'a' }])
    expect(overallGrade(s)).toBe(5.5)
    expect(overallGrade(blockStates([1], []))).toBeNull()
    expect(pickNextBlock([])).toBeNull()
  })
})

describe('handwritten drill', () => {
  it('right ones are ticked off, wrong ones come again until none are wrong', () => {
    let s = startDrill(['a', 'b', 'c'], noShuffle)
    expect(s.round).toBe(1)
    const seen: string[] = []
    const answers: Record<string, boolean[]> = { a: [true], b: [false, false, true], c: [false, true] }
    while (!drillFinished(s)) {
      const id = drillCurrent(s)!
      seen.push(id)
      s = drillMark(s, answers[id].shift()!, noShuffle)
    }
    expect(seen.filter((x) => x === 'b')).toHaveLength(3)
    expect(seen.filter((x) => x === 'c')).toHaveLength(2)
    expect(s.done.sort()).toEqual(['a', 'b', 'c'])
    expect(s.round).toBe(3)
  })
  it('all right in round 1 → finished, no round 2', () => {
    let s = startDrill(['a', 'b'])
    s = drillMark(s, true)
    s = drillMark(s, true)
    expect(drillFinished(s)).toBe(true)
    expect(s.round).toBe(1)
    expect(drillMark(s, true)).toBe(s)
  })
})

describe('blockDayPlan', () => {
  const now = new Date(2026, 10, 20, 15) // Fr 20.11.
  it('5 blocks, test on Thursday 26.11.: one block a day, Wednesday for repeating', () => {
    const p = blockDayPlan(blockStates([46, 46, 46, 45, 45], []), now, '2026-11-26')!
    expect(p.map((d) => d.date)).toEqual(['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25'])
    expect(p.map((d) => d.learn)).toEqual([[0], [1], [2], [3], [4], []])
    expect(p[5].finalReview).toBe(true)
  })
  it('a block finished today counts for today', () => {
    const st = blockStates([46, 46, 46, 45, 45], [{ block: 0, blocks: 5, grade: 5, date: new Date(2026, 10, 20, 14).toISOString() }])
    const p = blockDayPlan(st, now, '2026-11-26')!
    expect(p[0]).toMatchObject({ learn: [], done: [0] })
    expect(p[1].learn).toEqual([1])
  })
  it('little time: several blocks a day; test today → no plan', () => {
    const p = blockDayPlan(blockStates([46, 46, 46, 45, 45], []), now, '2026-11-23')!
    expect(p.map((d) => d.learn)).toEqual([[0, 1, 2], [3, 4], []])
    expect(blockDayPlan(blockStates([46], []), now, '2026-11-20')).toBeNull()
  })
  it('a failed block stays in the plan', () => {
    const st = blockStates([46, 46, 46, 45, 45], [{ block: 0, blocks: 5, grade: 3, date: new Date(2026, 10, 20, 14).toISOString() }])
    const p = blockDayPlan(st, now, '2026-11-26')!
    expect(p[0]).toMatchObject({ learn: [0], done: [] })
  })
})
