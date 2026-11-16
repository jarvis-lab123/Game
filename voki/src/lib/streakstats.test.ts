import { describe, it, expect } from 'vitest'
import { streakInfo } from './streakstats'

const at = (s: string) => new Date(s).toISOString()
// Monday 2026-11-16
const now = new Date('2026-11-16T15:00:00')

describe('streakInfo', () => {
  it('is empty without logs', () => {
    const r = streakInfo([], now)
    expect(r.current).toBe(0)
    expect(r.longest).toBe(0)
    expect(r.activeDays30).toBe(0)
    expect(r.week).toHaveLength(7)
    expect(r.week.map((d) => d.label)).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'])
  })
  it('counts back from today', () => {
    const r = streakInfo([at('2026-11-16T08:00:00'), at('2026-11-15T23:00:00'), at('2026-11-14T00:30:00'), at('2026-11-12T10:00:00')], now)
    expect(r.current).toBe(3)
  })
  it('counts back from yesterday when today has no log yet', () => {
    const r = streakInfo([at('2026-11-15T08:00:00'), at('2026-11-14T08:00:00')], now)
    expect(r.current).toBe(2)
  })
  it('is 0 when neither today nor yesterday is active', () => {
    expect(streakInfo([at('2026-11-14T08:00:00')], now).current).toBe(0)
  })
  it('finds the longest run, also across month borders', () => {
    const logs = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-10', '2026-11-16'].map((d) => at(`${d}T12:00:00`))
    const r = streakInfo(logs, now)
    expect(r.longest).toBe(5)
    expect(r.current).toBe(1)
  })
  it('longest is at least current', () => {
    const r = streakInfo([at('2026-11-16T08:00:00'), at('2026-11-15T08:00:00')], now)
    expect(r.longest).toBe(2)
  })
  it('builds the Monday–Sunday week with today marked', () => {
    const wed = new Date('2026-11-18T09:00:00')
    const r = streakInfo([at('2026-11-16T08:00:00'), at('2026-11-18T07:00:00'), at('2026-11-15T08:00:00')], wed)
    expect(r.week.map((d) => d.date)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'])
    expect(r.week.map((d) => d.active)).toEqual([true, false, true, false, false, false, false])
    expect(r.week.map((d) => d.today)).toEqual([false, false, true, false, false, false, false])
  })
  it('handles Sunday as the last day of the week', () => {
    const sun = new Date('2026-11-22T20:00:00')
    const r = streakInfo([], sun)
    expect(r.week[0].date).toBe('2026-11-16')
    expect(r.week[6].today).toBe(true)
  })
  it('counts distinct active days in the last 30 days (including today)', () => {
    const logs = [at('2026-11-16T08:00:00'), at('2026-11-16T09:00:00'), at('2026-10-18T08:00:00'), at('2026-10-17T08:00:00')]
    expect(streakInfo(logs, now).activeDays30).toBe(2)
  })
})
