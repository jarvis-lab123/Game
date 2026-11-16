import { describe, it, expect } from 'vitest'
import { crunchPlan, MAX_CRUNCH_MINUTES, MAX_SESSION_MINUTES } from './crunch'

const base = { days: 5, unintroduced: 0, minutesNeeded: 0, dailyGoal: 15 }

describe('crunchPlan (Not-Modus)', () => {
  it('inactive when there is enough time: normal daily goal, one session', () => {
    const p = crunchPlan({ ...base, days: 5, minutesNeeded: 50 }) // 10 min/day < 18
    expect(p).toMatchObject({ active: false, minutesPerDay: 15, sessionsPerDay: 1, sessionMinutes: 15 })
    expect(p.reason).toBeTruthy()
  })
  it('active when the daily need is more than 1.2 x the goal', () => {
    const p = crunchPlan({ ...base, days: 4, minutesNeeded: 100 }) // 25/day > 18
    expect(p).toMatchObject({ active: true, minutesPerDay: 25, sessionsPerDay: 1, sessionMinutes: 25 })
  })
  it('exactly 1.2 x the goal is not yet crunch', () => {
    expect(crunchPlan({ ...base, days: 5, minutesNeeded: 90 }).active).toBe(false) // 18/day
  })
  it('splits into sessions of at most 25 minutes', () => {
    const p = crunchPlan({ ...base, days: 2, minutesNeeded: 150 }) // 75/day
    expect(p).toMatchObject({ active: true, minutesPerDay: 75, sessionsPerDay: 3, sessionMinutes: 25 })
    const q = crunchPlan({ ...base, days: 2, minutesNeeded: 104 }) // 52/day -> 3 x 18
    expect(q).toMatchObject({ minutesPerDay: 52, sessionsPerDay: 3, sessionMinutes: 18 })
    expect(q.sessionMinutes).toBeLessThanOrEqual(MAX_SESSION_MINUTES)
  })
  it('active in the last 2 days when words are still unintroduced, even if the time fits', () => {
    const p = crunchPlan({ ...base, days: 2, unintroduced: 3, minutesNeeded: 10 })
    expect(p).toMatchObject({ active: true, minutesPerDay: 5, sessionsPerDay: 1, sessionMinutes: 5 })
    expect(p.reason).toMatch(/3 Wörter/)
  })
  it('exam today counts as one day', () => {
    const p = crunchPlan({ ...base, days: 0, minutesNeeded: 40 })
    expect(p).toMatchObject({ active: true, minutesPerDay: 40, sessionsPerDay: 2, sessionMinutes: 20 })
  })
  it('days 1 and 0 give the same per-day need', () => {
    expect(crunchPlan({ ...base, days: 1, minutesNeeded: 40 }).minutesPerDay).toBe(40)
  })
  it('never more than 7 days before the exam', () => {
    expect(crunchPlan({ ...base, days: 8, minutesNeeded: 1000 }).active).toBe(false)
    expect(crunchPlan({ ...base, days: 7, minutesNeeded: 1000 }).active).toBe(true)
  })
  it('inactive after the exam', () => {
    const p = crunchPlan({ ...base, days: -1, unintroduced: 10, minutesNeeded: 200 })
    expect(p).toMatchObject({ active: false, minutesPerDay: 15, sessionsPerDay: 1 })
  })
  it('inactive when nothing is left to learn', () => {
    const p = crunchPlan({ ...base, days: 1, unintroduced: 0, minutesNeeded: 0 })
    expect(p).toMatchObject({ active: false, minutesPerDay: 15, sessionsPerDay: 1, sessionMinutes: 15 })
  })
  it(`caps the day at ${MAX_CRUNCH_MINUTES} minutes (a 15-year-old still needs sleep)`, () => {
    const p = crunchPlan({ ...base, days: 0, minutesNeeded: 400 })
    expect(p.minutesPerDay).toBe(MAX_CRUNCH_MINUTES)
    expect(p.sessionsPerDay * p.sessionMinutes).toBeGreaterThanOrEqual(MAX_CRUNCH_MINUTES)
    expect(p.sessionMinutes).toBeLessThanOrEqual(MAX_SESSION_MINUTES)
  })
  it('a zero daily goal does not divide by zero', () => {
    const p = crunchPlan({ ...base, days: 3, minutesNeeded: 30, dailyGoal: 0 })
    expect(p.active).toBe(true)
    expect(p.minutesPerDay).toBe(10)
  })
})
