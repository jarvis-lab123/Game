import type { VokiDB } from './db'
import { masteryInfo } from './mastery'
import type { Card } from '../lib/types'

export const DRILL_SECONDS = 20
const RECENT_DAYS = 14

function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

/**
 * Fehlerheft drill: everything the Fehlerheft lists – wobbly words, leeches,
 * overconfident words and recent mistakes – exactly what the Fehlerheft lists.
 */
export async function drillCards(db: VokiDB, minutes: number, deckId?: string): Promise<Card[]> {
  const decks = new Map((await db.decks.filter((d) => !d.archived && (!deckId || d.id === deckId)).toArray()).map((d) => [d.id, d]))
  const { byNote } = await masteryInfo(db, [...decks.keys()])
  const since = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString()
  const wrong = new Set((await db.logs.where('timestamp').aboveOrEqual(since).toArray()).filter((l) => !l.correct && l.mode !== 'intro').map((l) => l.cardId))
  const notes = await db.notes.toArray()
  const noteIds = new Set(notes.map((n) => n.id))
  const flagged = new Set(notes.filter((n) => n.tags.includes('überschätzt')).map((n) => n.id))
  const cards = (await db.cards.toArray()).filter(
    (c) =>
      !c.suspended &&
      decks.get(c.deckId)?.directions.includes(c.direction) &&
      noteIds.has(c.noteId) &&
      (byNote.get(c.noteId) === 'wackelt' || c.leech || wrong.has(c.id) || flagged.has(c.noteId)),
  )
  return shuffle(cards).slice(0, Math.max(1, Math.floor((minutes * 60) / DRILL_SECONDS)))
}

/** A correct drill answer takes the word out of "überschätzt". */
export async function clearOverconfident(db: VokiDB, noteId: string): Promise<void> {
  const n = await db.notes.get(noteId)
  if (n?.tags.includes('überschätzt')) await db.notes.put({ ...n, tags: n.tags.filter((t) => t !== 'überschätzt'), updatedAt: new Date().toISOString() })
}
