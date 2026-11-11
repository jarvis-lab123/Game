import { Dexie, type EntityTable } from 'dexie'
import type { Card, Deck, Note, ReviewLog, Settings } from '../lib/types'

export interface Meta { key: string; value: unknown }

export class VokiDB extends Dexie {
  decks!: EntityTable<Deck, 'id'>
  notes!: EntityTable<Note, 'id'>
  cards!: EntityTable<Card, 'id'>
  logs!: EntityTable<ReviewLog, 'id'>
  settings!: EntityTable<Settings, 'id'>
  meta!: EntityTable<Meta, 'key'>

  constructor(name = 'voki') {
    super(name)
    this.version(1).stores({
      decks: 'id, archived',
      notes: 'id, deckId',
      cards: 'id, deckId, noteId, stage, due, [deckId+stage]',
      logs: 'id, cardId, deckId, timestamp',
      settings: 'id',
      meta: 'key',
    })
  }
}

export const db = new VokiDB()
