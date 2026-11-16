import { dayKey } from './stats'
import type { ReviewLog, ReviewMode, TestResult } from './types'

/** Learning minutes per local day (measured answer times only), oldest → newest. */
export function minutesByDay(logs: ReviewLog[], days: number, now: Date): { date: string; minutes: number; answers: number }[] {
  const keys = Array.from({ length: days }, (_, i) => dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1) + i)))
  const t = new Map(keys.map((k) => [k, { ms: 0, n: 0 }]))
  for (const l of logs) {
    const v = t.get(dayKey(new Date(l.timestamp)))
    if (!v) continue
    v.n++
    v.ms += Math.max(0, Math.min(l.durationMs || 0, 120000))
  }
  return keys.map((date) => ({ date, minutes: Math.round(t.get(date)!.ms / 6000) / 10, answers: t.get(date)!.n }))
}

export type ModeGroup = 'Tippen' | 'Auswählen' | 'Handschrift & Blöcke' | 'Hören' | 'Umdrehen' | 'Fehlerheft' | 'Probetests' | 'Neue Wörter'

const GROUP: Record<ReviewMode, ModeGroup> = {
  type: 'Tippen', cram: 'Tippen', mc: 'Auswählen', hand: 'Handschrift & Blöcke', listen: 'Hören', flip: 'Umdrehen', drill: 'Fehlerheft', test: 'Probetests', intro: 'Neue Wörter',
}

export interface ModeRow { mode: ModeGroup; answers: number; accuracy: number | null }

/** Answers and share right per way of learning, most used first. „Neue Wörter“ has no accuracy. */
export function modeBreakdown(logs: ReviewLog[]): ModeRow[] {
  const t = new Map<ModeGroup, { n: number; ok: number }>()
  for (const l of logs) {
    const g = GROUP[l.mode] ?? 'Tippen'
    const v = t.get(g) ?? { n: 0, ok: 0 }
    v.n++
    if (l.correct) v.ok++
    t.set(g, v)
  }
  return [...t].map(([mode, v]) => ({ mode, answers: v.n, accuracy: mode === 'Neue Wörter' ? null : v.ok / v.n })).sort((a, b) => b.answers - a.answers)
}

export interface HardWord { noteId: string; wrong: number; total: number }

/** Words answered wrong most often (at least `minWrong` times), worst first. */
export function hardestWords(logs: ReviewLog[], noteOf: (cardId: string) => string | undefined, limit = 8, minWrong = 2): HardWord[] {
  const t = new Map<string, HardWord>()
  for (const l of logs) {
    if (l.mode === 'intro') continue
    const id = noteOf(l.cardId)
    if (!id) continue
    const v = t.get(id) ?? { noteId: id, wrong: 0, total: 0 }
    v.total++
    if (!l.correct) v.wrong++
    t.set(id, v)
  }
  return [...t.values()]
    .filter((w) => w.wrong >= minWrong)
    .sort((a, b) => b.wrong - a.wrong || b.wrong / b.total - a.wrong / a.total)
    .slice(0, limit)
}

export const DAYPARTS = ['Morgen', 'Mittag', 'Nachmittag', 'Abend', 'Nacht'] as const
export type Daypart = (typeof DAYPARTS)[number]

export function daypartOf(d: Date): Daypart {
  const h = d.getHours()
  return h >= 5 && h < 11 ? 'Morgen' : h < 14 && h >= 11 ? 'Mittag' : h >= 14 && h < 18 ? 'Nachmittag' : h >= 18 && h < 22 ? 'Abend' : 'Nacht'
}

export interface DaypartRow { part: Daypart; answers: number; accuracy: number | null }

/** Answers and share right per time of day (graded answers only, no new-word intros). */
export function byDaypart(logs: ReviewLog[]): { rows: DaypartRow[]; best: Daypart | null } {
  const t = new Map<Daypart, { n: number; ok: number }>(DAYPARTS.map((p) => [p, { n: 0, ok: 0 }]))
  for (const l of logs) {
    if (l.mode === 'intro') continue
    const v = t.get(daypartOf(new Date(l.timestamp)))!
    v.n++
    if (l.correct) v.ok++
  }
  const rows = DAYPARTS.map((part) => ({ part, answers: t.get(part)!.n, accuracy: t.get(part)!.n ? t.get(part)!.ok / t.get(part)!.n : null }))
  const ranked = rows.filter((r) => r.answers >= 20).sort((a, b) => b.accuracy! - a.accuracy!)
  return { rows, best: ranked[0]?.part ?? null }
}

export interface GradeStats { count: number; average: number | null; best: number | null; last: number | null; history: { date: string; grade: number; block: boolean }[] }

/** Swiss grades of all tests (normal and block tests), oldest → newest. Average rounded to tenths. */
export function gradeStats(tests: Pick<TestResult, 'date' | 'grade' | 'block'>[]): GradeStats {
  const h = [...tests].sort((a, b) => a.date.localeCompare(b.date)).map((t) => ({ date: t.date, grade: t.grade, block: t.block != null }))
  if (!h.length) return { count: 0, average: null, best: null, last: null, history: [] }
  const avg = h.reduce((s, t) => s + t.grade, 0) / h.length
  return { count: h.length, average: Math.round(avg * 10) / 10, best: Math.max(...h.map((t) => t.grade)), last: h[h.length - 1].grade, history: h }
}

/** Answers and minutes this week (Mon–today) vs. the whole last week. */
export function weekCompare(logs: ReviewLog[], now: Date): { thisWeek: { answers: number; minutes: number }; lastWeek: { answers: number; minutes: number } } {
  const weekday = (now.getDay() + 6) % 7
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekday).getTime()
  const prev = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekday - 7).getTime()
  const a = { answers: 0, ms: 0 }
  const b = { answers: 0, ms: 0 }
  for (const l of logs) {
    const t = new Date(l.timestamp).getTime()
    const bucket = t >= start ? a : t >= prev ? b : null
    if (!bucket) continue
    bucket.answers++
    bucket.ms += Math.max(0, Math.min(l.durationMs || 0, 120000))
  }
  const m = (x: { answers: number; ms: number }) => ({ answers: x.answers, minutes: Math.round(x.ms / 60000) })
  return { thisWeek: m(a), lastWeek: m(b) }
}
