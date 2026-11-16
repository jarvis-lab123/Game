/** "Not-Modus": the test is close and the normal daily goal won't get every word to "sitzt" in time. */

export const CRUNCH_DAYS = 7
export const CRUNCH_FACTOR = 1.2
export const MAX_SESSION_MINUTES = 25
/** Upper limit per day, even when more would be needed: focus drops and sleep matters more. */
export const MAX_CRUNCH_MINUTES = 120

export interface CrunchInput {
  /** daysUntil(exam): 0 = today, negative = past */
  days: number
  /** words not yet introduced */
  unintroduced: number
  /** deckForecast minutes until everything "sitzt" */
  minutesNeeded: number
  dailyGoal: number
}

export interface CrunchPlan {
  active: boolean
  /** short German explanation */
  reason: string
  minutesPerDay: number
  sessionsPerDay: number
  sessionMinutes: number
}

const words = (n: number) => (n === 1 ? '1 Wort' : `${n} Wörter`)

/**
 * Active when the exam is 0..7 days away and either the daily need is above 1.2 × the goal,
 * or there are still unintroduced words in the last 2 days. The day is split into sessions of max 25 min.
 */
export function crunchPlan(i: CrunchInput): CrunchPlan {
  const goal = Math.max(0, i.dailyGoal)
  const normal = (reason: string): CrunchPlan => ({ active: false, reason, minutesPerDay: goal, sessionsPerDay: 1, sessionMinutes: goal })
  if (!Number.isFinite(i.days) || i.days < 0) return normal('Kein anstehender Test.')
  if (i.minutesNeeded <= 0) return normal('Alles sitzt – normal weiterlernen.')
  if (i.days > CRUNCH_DAYS) return normal('Genug Zeit bis zum Test – normaler Modus.')
  const span = Math.max(1, i.days)
  const need = Math.ceil(i.minutesNeeded / span)
  const overload = need > goal * CRUNCH_FACTOR
  const late = i.days <= 2 && i.unintroduced > 0
  if (!overload && !late) return normal('Das schaffst du mit deinem Tagesziel.')
  const minutesPerDay = Math.min(need, MAX_CRUNCH_MINUTES)
  const sessionsPerDay = Math.ceil(minutesPerDay / MAX_SESSION_MINUTES)
  const sessionMinutes = Math.ceil(minutesPerDay / sessionsPerDay)
  const reason = late
    ? `Noch ${words(i.unintroduced)} neu – mit mehreren kurzen Sessions schaffst du das.`
    : `Bis alles sitzt, brauchst du ca. ${need} Min pro Tag – mehr als dein Ziel von ${goal} Min.`
  return { active: true, reason, minutesPerDay, sessionsPerDay, sessionMinutes }
}
