import type { VokiDB } from './db'
import { loadSettings } from './queries'
import { noteMastery, recentByNote, type Mastery } from '../lib/mastery'
import type { Card } from '../lib/types'

export interface MasteryInfo { byNote: Map<string, Mastery>; counts: Record<Mastery, number> }

export function emptyCounts(): Record<Mastery, number> {
  return { sitzt: 0, lernt: 0, wackelt: 0, neu: 0 }
}

/** "Sitzt das?" for every word of the given decks (all active decks if omitted). */
export async function masteryInfo(db: VokiDB, deckIds?: string[], now = new Date()): Promise<MasteryInfo> {
  const settings = await loadSettings(db)
  const decks = (await db.decks.toArray()).filter((d) => !d.archived && (!deckIds || deckIds.includes(d.id)))
  const dirs = new Map(decks.map((d) => [d.id, d.directions]))
  const noteIds = new Set((await db.notes.toCollection().primaryKeys()) as string[])
  const cards = (await db.cards.where('deckId').anyOf([...dirs.keys()]).toArray()).filter((c) => dirs.get(c.deckId)?.includes(c.direction) && noteIds.has(c.noteId))
  const logs = await db.logs.where('deckId').anyOf([...dirs.keys()]).toArray()
  const noteOfCard = new Map(cards.map((c) => [c.id, c.noteId]))
  const recent = recentByNote(logs, (id) => noteOfCard.get(id))
  const byNoteCards = new Map<string, Card[]>()
  for (const c of cards) byNoteCards.set(c.noteId, [...(byNoteCards.get(c.noteId) ?? []), c])
  const byNote = new Map<string, Mastery>()
  const counts = emptyCounts()
  for (const [noteId, cs] of byNoteCards) {
    if (cs.every((c) => c.suspended)) continue
    const m = noteMastery(cs, recent.get(noteId) ?? [], now, settings.desiredRetention)
    byNote.set(noteId, m)
    counts[m]++
  }
  return { byNote, counts }
}
