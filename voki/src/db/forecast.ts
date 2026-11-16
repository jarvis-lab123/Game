import type { VokiDB } from './db'
import { masteryInfo } from './mastery'
import { personalPace, remainingEffort, type Pace } from '../lib/forecast'
import type { Card } from '../lib/types'

export interface Effort { answers: number; minutes: number }

/** Cards of active decks (current directions only, existing notes), optionally one deck. */
async function liveCards(db: VokiDB, deckId?: string): Promise<{ deckIds: string[]; cards: Card[] }> {
  const decks = (await db.decks.toArray()).filter((d) => !d.archived && (!deckId || d.id === deckId))
  const dirs = new Map(decks.map((d) => [d.id, d.directions]))
  const noteIds = new Set((await db.notes.toCollection().primaryKeys()) as string[])
  const deckIds = [...dirs.keys()]
  const cards = (await db.cards.where('deckId').anyOf(deckIds).toArray()).filter((c) => dirs.get(c.deckId)?.includes(c.direction) && noteIds.has(c.noteId))
  return { deckIds, cards }
}

/** Estimated effort until every word of the deck (all active decks if omitted) "sitzt", at the learner's own pace. */
export async function deckForecast(db: VokiDB, deckId?: string): Promise<{ pace: Pace } & Effort> {
  const [{ deckIds, cards }, logs] = await Promise.all([liveCards(db, deckId), db.logs.toArray()])
  const pace = personalPace(logs)
  if (deckIds.length === 0) return { pace, answers: 0, minutes: 0 }
  const m = await masteryInfo(db, deckIds)
  return { pace, ...remainingEffort(cards, (id) => m.byNote.get(id), pace) }
}

/** Same as deckForecast, for every active deck at once plus the total (one pass over the data). */
export async function allDeckForecasts(db: VokiDB): Promise<{ pace: Pace; total: Effort; byDeck: Map<string, Effort> }> {
  const [{ deckIds, cards }, logs] = await Promise.all([liveCards(db), db.logs.toArray()])
  const pace = personalPace(logs)
  const m = await masteryInfo(db, deckIds)
  const masteryOf = (id: string) => m.byNote.get(id)
  const byDeck = new Map<string, Effort>()
  for (const id of deckIds) byDeck.set(id, remainingEffort(cards.filter((c) => c.deckId === id), masteryOf, pace))
  return { pace, total: remainingEffort(cards, masteryOf, pace), byDeck }
}
