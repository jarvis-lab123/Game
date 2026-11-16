import type { VokiDB } from './db'
import type { Card, Deck, Direction, Language, Note } from '../lib/types'
import { guessMapping, mapRows, parseDelimited } from '../lib/tsv'
import { newCard } from './repo'

export interface BuiltinDeck {
  key: string
  name: string
  language: Language
  directions: Direction[]
  examDate?: string
  tsv: string
}

/**
 * Adds a deck that ships with the app – once. Stable ids (`builtin-<key>…`) make the
 * same records on every device, so the sync merges instead of duplicating.
 * A deleted built-in deck (tombstone) is never re-added.
 */
export async function seedDeck(db: VokiDB, b: BuiltinDeck): Promise<boolean> {
  const deckId = `builtin-${b.key}`
  const flag = `seed:${b.key}`
  return db.transaction('rw', [db.decks, db.notes, db.cards, db.meta, db.tombstones], async () => {
    if (await db.meta.get(flag)) return false
    const deleted = await db.tombstones.get(`decks:${deckId}`)
    if (deleted || (await db.decks.get(deckId))) {
      await db.meta.put({ key: flag, value: true })
      return false
    }
    const now = new Date()
    const iso = now.toISOString()
    const rows = parseDelimited(b.tsv).rows
    const drafts = mapRows(rows, guessMapping(5), new Set()).filter((d) => d.valid && !d.duplicate)
    const deck: Deck = { id: deckId, name: b.name, language: b.language, directions: b.directions, examDate: b.examDate, strictAccents: false, createdAt: iso, archived: false, updatedAt: iso }
    const notes: Note[] = drafts.map((d, i) => ({ id: `${deckId}-n${i}`, deckId, term: d.term, translation: d.translation, example: d.example, gender: d.gender, notes: d.notes, tags: [], updatedAt: iso }))
    const cards: Card[] = notes.flatMap((n, i) => b.directions.map((dir) => ({ ...newCard(n, dir, i, now), id: `${n.id}-${dir}` })))
    await db.decks.add(deck)
    await db.notes.bulkAdd(notes)
    await db.cards.bulkAdd(cards)
    await db.meta.put({ key: flag, value: true })
    return true
  })
}

import catalog from '../data/decks.json'

export interface CatalogEntry { key: string; name: string; language: Language; directions: Direction[]; examDate?: string; file: string }

/** Wörtli-Sets that ship with Voki. Add a TSV in src/data/decks/ and an entry in decks.json – pushed = everyone has it. */
export const CATALOG = catalog as CatalogEntry[]

const FILES = import.meta.glob('../data/decks/*.tsv', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>

/** Adds every catalog set that this device doesn't have yet (and never re-adds deleted ones). */
export async function seedBuiltinDecks(db: VokiDB): Promise<void> {
  for (const entry of CATALOG) {
    if (await db.meta.get(`seed:${entry.key}`)) continue
    const load = FILES[`../data/decks/${entry.file}`]
    if (!load) continue
    const tsv = await load()
    await seedDeck(db, { key: entry.key, name: entry.name, language: entry.language, directions: entry.directions, examDate: entry.examDate, tsv })
  }
}
