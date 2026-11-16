import { describe, it, expect } from 'vitest'
import { activityByDay, dueForecast, accuracy, learnedWords, dayKey } from './stats'
import { mkCard } from './testutil'
import type { Card, ReviewLog } from './types'

let i = 0
function mkLog(p: Partial<ReviewLog>): ReviewLog {
  i++
  return { id: `l${i}`, cardId: 'c1', deckId: 'd1', timestamp: new Date('2026-11-16T10:00:00').toISOString(), mode: 'type', rating: 3, correct: true, durationMs: 1000, ...p }
}
const now = new Date('2026-11-16T15:00:00')

describe('dayKey', () => {
  it('formats local dates', () => {
    expect(dayKey(new Date('2026-01-05T23:30:00'))).toBe('2026-01-05')
  })
})

describe('activityByDay', () => {
  it('is zero-filled, oldest to newest, counts per local day', () => {
    const logs = [
      mkLog({ timestamp: new Date('2026-11-16T08:00:00').toISOString() }),
      mkLog({ timestamp: new Date('2026-11-16T23:59:00').toISOString() }),
      mkLog({ timestamp: new Date('2026-11-14T00:01:00').toISOString() }),
      mkLog({ timestamp: new Date('2026-11-01T12:00:00').toISOString() }), // outside window
      mkLog({ timestamp: new Date('2026-11-17T12:00:00').toISOString() }), // future
    ]
    const r = activityByDay(logs, 4, now)
    expect(r).toEqual([
      { date: '2026-11-13', count: 0 },
      { date: '2026-11-14', count: 1 },
      { date: '2026-11-15', count: 0 },
      { date: '2026-11-16', count: 2 },
    ])
  })
  it('handles DST changes (length stays exact)', () => {
    const r = activityByDay([], 400, now)
    expect(r).toHaveLength(400)
    expect(new Set(r.map((d) => d.date)).size).toBe(400)
    expect(r[399].date).toBe('2026-11-16')
  })
})

describe('dueForecast', () => {
  const at = (s: string) => new Date(s).getTime()
  it('counts learned cards per day, overdue on day 0, ignores suspended/unlearned/outside', () => {
    const cards: Card[] = [
      mkCard({ stage: 'review', due: at('2026-11-10T09:00:00') }), // overdue -> day 0
      mkCard({ stage: 'review', due: at('2026-11-16T22:00:00') }), // today
      mkCard({ stage: 'review', due: at('2026-11-17T01:00:00') }), // tomorrow
      mkCard({ stage: 'review', due: at('2026-11-18T12:00:00') }),
      mkCard({ stage: 'review', due: at('2026-11-19T12:00:00') }), // outside 3 days
      { ...mkCard({ stage: 'review', due: at('2026-11-17T12:00:00') }), suspended: true },
      mkCard({ stage: 'mc', due: at('2026-11-17T12:00:00') }),
    ]
    expect(dueForecast(cards, 3, now)).toEqual([
      { date: '2026-11-16', count: 2 },
      { date: '2026-11-17', count: 1 },
      { date: '2026-11-18', count: 1 },
    ])
  })
})

describe('accuracy', () => {
  const dirs: Record<string, Card['direction']> = { a: 'toTarget', b: 'toNative' }
  const dirOf = (id: string) => dirs[id]
  it('splits by direction and ignores intro/cram/drill/test logs', () => {
    const logs = [
      mkLog({ cardId: 'a', correct: true }),
      mkLog({ cardId: 'a', correct: false, mode: 'flip' }),
      mkLog({ cardId: 'b', correct: true, mode: 'mc' }),
      mkLog({ cardId: 'b', correct: true, mode: 'listen' }),
      mkLog({ cardId: 'b', correct: false, mode: 'intro' }),
      mkLog({ cardId: 'b', correct: false, mode: 'cram' }),
      mkLog({ cardId: 'a', correct: false, mode: 'test' }),
      mkLog({ cardId: 'zz', correct: false, mode: 'hand' }), // unknown direction: total only
    ]
    expect(accuracy(logs, dirOf)).toEqual({ toTarget: 0.5, toNative: 1, total: 3 / 5, n: 5 })
  })
  it('returns nulls without data and filters by deck', () => {
    const logs = [mkLog({ cardId: 'a', deckId: 'd1' }), mkLog({ cardId: 'b', deckId: 'd2', correct: false })]
    expect(accuracy([], dirOf)).toEqual({ toTarget: null, toNative: null, total: null, n: 0 })
    expect(accuracy(logs, dirOf, { deckId: 'd2' })).toEqual({ toTarget: null, toNative: 0, total: 0, n: 1 })
  })
})

describe('learnedWords', () => {
  it('counts distinct notes with a review card', () => {
    const cards = [
      mkCard({ noteId: 'x', stage: 'review' }),
      mkCard({ noteId: 'x', stage: 'review', direction: 'toNative' }),
      mkCard({ noteId: 'y', stage: 'type' }),
      mkCard({ noteId: 'y', stage: 'review' }),
      mkCard({ noteId: 'z', stage: 'new' }),
    ]
    expect(learnedWords(cards)).toBe(2)
    expect(learnedWords([])).toBe(0)
  })
})
