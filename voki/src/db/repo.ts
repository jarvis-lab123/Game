import { createEmptyCard } from 'ts-fsrs'
import type { VokiDB } from './db'
import type { Card, Deck, Direction, Language, Note } from '../lib/types'
import type { NoteDraft } from '../lib/tsv'
import { uid } from '../lib/id'

export const NEVER = Number.MAX_SAFE_INTEGER

export async function createDeck(
  db: VokiDB,
  p: { name: string; language: Language; directions: Direction[]; examDate?: string; strictAccents?: boolean },
): Promise<Deck> {
  const now = new Date().toISOString()
  const deck: Deck = {
    id: uid(),
    name: p.name.trim() || 'Neues Deck',
    language: p.language,
    directions: p.directions.length ? p.directions : ['toTarget'],
    examDate: p.examDate || undefined,
    strictAccents: p.strictAccents ?? false,
    createdAt: now,
    archived: false,
    updatedAt: now,
  }
  await db.decks.add(deck)
  return deck
}

export function newCard(note: Pick<Note, 'id' | 'deckId'>, direction: Direction, order: number, now = new Date()): Card {
  return {
    id: uid(),
    noteId: note.id,
    deckId: note.deckId,
    direction,
    stage: 'new',
    fsrs: createEmptyCard(now),
    due: NEVER,
    leech: false,
    suspended: false,
    order,
    updatedAt: now.toISOString(),
  }
}

/** Imports valid, non-duplicate drafts in one transaction. Returns the number of notes created. */
export async function importNotes(db: VokiDB, deckId: string, drafts: NoteDraft[], directions: Direction[]): Promise<number> {
  const now = new Date()
  const iso = now.toISOString()
  const keep = drafts.filter((d) => d.valid && !d.duplicate)
  return db.transaction('rw', db.notes, db.cards, async () => {
    const start = await db.cards.where('deckId').equals(deckId).count()
    const notes: Note[] = keep.map((d) => ({
      id: uid(),
      deckId,
      term: d.term,
      translation: d.translation,
      example: d.example,
      gender: d.gender,
      notes: d.notes,
      tags: [],
      updatedAt: iso,
    }))
    const cards = notes.flatMap((n, i) => directions.map((dir) => newCard(n, dir, start + i, now)))
    await db.notes.bulkAdd(notes)
    await db.cards.bulkAdd(cards)
    return notes.length
  })
}

/** Keeps cards in sync when the directions of a deck change. */
export async function syncDirections(db: VokiDB, deck: Deck): Promise<void> {
  await db.transaction('rw', db.notes, db.cards, async () => {
    const notes = await db.notes.where('deckId').equals(deck.id).toArray()
    const cards = await db.cards.where('deckId').equals(deck.id).toArray()
    const have = new Set(cards.map((c) => `${c.noteId}|${c.direction}`))
    const add: Card[] = []
    notes.forEach((n, i) => {
      for (const dir of deck.directions) if (!have.has(`${n.id}|${dir}`)) add.push(newCard(n, dir, i))
    })
    await db.cards.bulkAdd(add)
    const drop = cards.filter((c) => !deck.directions.includes(c.direction) && c.stage === 'new').map((c) => c.id)
    await db.cards.bulkDelete(drop)
  })
}

export async function deleteDeck(db: VokiDB, deckId: string): Promise<void> {
  await db.transaction('rw', [db.decks, db.notes, db.cards, db.logs], async () => {
    await db.cards.where('deckId').equals(deckId).delete()
    await db.notes.where('deckId').equals(deckId).delete()
    await db.logs.where('deckId').equals(deckId).delete()
    await db.decks.delete(deckId)
  })
}

export async function deleteNote(db: VokiDB, noteId: string): Promise<void> {
  await db.transaction('rw', db.notes, db.cards, async () => {
    await db.cards.where('noteId').equals(noteId).delete()
    await db.notes.delete(noteId)
  })
}
