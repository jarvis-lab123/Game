import { describe, expect, it } from 'vitest'
import { byDaypart, daypartOf, gradeStats, hardestWords, minutesByDay, modeBreakdown, weekCompare } from './morestats'
import type { ReviewLog, ReviewMode } from './types'

let k = 0
const L = (ts: string, mode: ReviewMode, correct: boolean, durationMs = 10000, cardId = 'c1'): ReviewLog => ({ id: `l${k++}`, cardId, deckId: 'd', timestamp: new Date(ts).toISOString(), mode, rating: 3, correct, durationMs })

describe('morestats', () => {
  const now = new Date(2026, 10, 18, 20) // Wed 18.11.2026
  it('minutes per day, capped answer times', () => {
    const r = minutesByDay([L('2026-11-18T09:00', 'type', true, 60000), L('2026-11-18T09:01', 'type', true, 999999), L('2026-11-17T09:00', 'test', true, 0)], 2, now)
    expect(r).toEqual([{ date: '2026-11-17', minutes: 0, answers: 1 }, { date: '2026-11-18', minutes: 3, answers: 2 }])
  })
  it('groups the ways of learning', () => {
    const r = modeBreakdown([L('2026-11-18T09:00', 'hand', true), L('2026-11-18T09:00', 'hand', false), L('2026-11-18T09:00', 'intro', true), L('2026-11-18T09:00', 'cram', true)])
    expect(r[0]).toEqual({ mode: 'Handschrift & Blöcke', answers: 2, accuracy: 0.5 })
    expect(r.find((x) => x.mode === 'Neue Wörter')!.accuracy).toBeNull()
    expect(r.find((x) => x.mode === 'Tippen')!.answers).toBe(1)
  })
  it('hardest words: most wrong first, intros ignored', () => {
    const logs = [
      L('2026-11-18T09:00', 'type', false, 1, 'a'), L('2026-11-18T09:00', 'type', false, 1, 'a'), L('2026-11-18T09:00', 'type', true, 1, 'a'),
      L('2026-11-18T09:00', 'type', false, 1, 'b'), L('2026-11-18T09:00', 'type', false, 1, 'b'), L('2026-11-18T09:00', 'type', false, 1, 'b'),
      L('2026-11-18T09:00', 'type', false, 1, 'c'), L('2026-11-18T09:00', 'intro', false, 1, 'c'),
    ]
    const r = hardestWords(logs, (id) => `n-${id}`)
    expect(r.map((w) => w.noteId)).toEqual(['n-b', 'n-a'])
    expect(r[1]).toEqual({ noteId: 'n-a', wrong: 2, total: 3 })
  })
  it('time of day and best part (needs 20 answers)', () => {
    expect(daypartOf(new Date(2026, 0, 1, 7))).toBe('Morgen')
    expect(daypartOf(new Date(2026, 0, 1, 12))).toBe('Mittag')
    expect(daypartOf(new Date(2026, 0, 1, 23))).toBe('Nacht')
    const logs = [...Array(20)].map((_, i) => L('2026-11-18T07:00', 'type', i < 18)).concat([...Array(20)].map((_, i) => L('2026-11-18T19:00', 'type', i < 10)))
    const r = byDaypart(logs)
    expect(r.best).toBe('Morgen')
    expect(r.rows.find((x) => x.part === 'Abend')!.accuracy).toBe(0.5)
  })
  it('grade stats over all tests', () => {
    expect(gradeStats([]).average).toBeNull()
    const g = gradeStats([{ date: '2026-11-02', grade: 5, block: 0 }, { date: '2026-11-01', grade: 4 }, { date: '2026-11-03', grade: 5.5 }])
    expect(g).toMatchObject({ count: 3, average: 4.8, best: 5.5, last: 5.5 })
    expect(g.history.map((h) => h.block)).toEqual([false, true, false])
  })
  it('this week vs last week', () => {
    const r = weekCompare([L('2026-11-16T09:00', 'type', true, 60000), L('2026-11-12T09:00', 'type', true, 120000), L('2026-11-01T09:00', 'type', true)], now)
    expect(r).toEqual({ thisWeek: { answers: 1, minutes: 1 }, lastWeek: { answers: 1, minutes: 2 } })
  })
})
