import { dayKey } from './stats'

export interface StreakDay { date: string; label: string; active: boolean; today: boolean }
export interface StreakInfo { current: number; longest: number; week: StreakDay[]; activeDays30: number }

const LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Local day key `offset` calendar days from `now` (DST-safe). */
function dayAt(now: Date, offset: number): string {
  return dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset))
}

/** Streak numbers and the current week (local days); current counts back from today, or from yesterday if today has no log yet. */
export function streakInfo(logTimestamps: string[], now: Date): StreakInfo {
  const days = new Set(logTimestamps.map((t) => dayKey(new Date(t))))

  const start = days.has(dayAt(now, 0)) ? 0 : -1
  let current = 0
  while (days.has(dayAt(now, start - current))) current++

  let longest = 0
  const sorted = [...days].sort()
  let run = 0
  let prev: string | null = null
  for (const d of sorted) {
    if (prev) {
      const [y, m, dd] = prev.split('-').map(Number)
      run = dayKey(new Date(y, m - 1, dd + 1)) === d ? run + 1 : 1
    } else run = 1
    longest = Math.max(longest, run)
    prev = d
  }
  longest = Math.max(longest, current)

  const weekday = (now.getDay() + 6) % 7 // Mon = 0
  const week = LABELS.map((label, i) => {
    const date = dayAt(now, i - weekday)
    return { date, label, active: days.has(date), today: i === weekday }
  })

  let activeDays30 = 0
  for (let i = 0; i < 30; i++) if (days.has(dayAt(now, -i))) activeDays30++

  return { current, longest, week, activeDays30 }
}
