import type { Card, Deck } from './types'
import { retrievabilityAt } from './srs'

export const WARN_NEW_PER_DAY = 40
export const REVIEW_ONLY_DAYS = 2

function localMidnight(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Calendar days from today until the exam date (0 = today, negative = past). */
export function daysUntil(examDate: string, now: Date): number {
  return Math.round((localMidnight(parseDate(examDate)) - localMidnight(now)) / 86400000)
}

/** 08:00 local time on the exam day – the moment readiness is measured for. */
export function examDay(examDate: string): Date {
  const d = parseDate(examDate)
  d.setHours(8)
  return d
}

/** §6.1: ceil(unlearned / (days − 2)); the last 2 days are review only. */
export function newPerDay(unlearned: number, examDate: string, now: Date): number {
  const span = daysUntil(examDate, now) - REVIEW_ONLY_DAYS
  if (span <= 0 || unlearned <= 0) return 0
  return Math.ceil(unlearned / span)
}

export const needsWarning = (perDay: number) => perDay > WARN_NEW_PER_DAY

export function isExamActive(deck: Pick<Deck, 'examDate'>, now: Date): boolean {
  return !!deck.examDate && daysUntil(deck.examDate, now) >= 0
}

export interface Readiness {
  /** "Erkennen": foreign -> German */
  toNative: number | null
  /** "Schreiben": German -> foreign */
  toTarget: number | null
  overall: number | null
}

/** §6.2: mean retrievability of all cards on exam day, per direction. */
export function readiness(cards: Card[], examDate: string, retention: number): Readiness {
  const at = examDay(examDate)
  const live = cards.filter((c) => !c.suspended)
  const avg = (cs: Card[]) => (cs.length ? cs.reduce((s, c) => s + retrievabilityAt(c, at, retention), 0) / cs.length : null)
  return {
    toNative: avg(live.filter((c) => c.direction === 'toNative')),
    toTarget: avg(live.filter((c) => c.direction === 'toTarget')),
    overall: avg(live),
  }
}
