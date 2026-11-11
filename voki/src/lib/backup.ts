import type { VokiDB } from '../db/db'
import type { Card, Deck, Note, ReviewLog, Settings } from './types'

export interface BackupV1 {
  app: 'voki'
  version: 1
  exportedAt: string
  decks: Deck[]
  notes: Note[]
  cards: Card[]
  logs: ReviewLog[]
  settings: Settings[]
}

export async function exportBackup(db: VokiDB): Promise<BackupV1> {
  return {
    app: 'voki',
    version: 1,
    exportedAt: new Date().toISOString(),
    decks: await db.decks.toArray(),
    notes: await db.notes.toArray(),
    cards: await db.cards.toArray(),
    logs: await db.logs.toArray(),
    settings: await db.settings.toArray(),
  }
}

/** Throws a German error message if this is not a Voki backup. Revives FSRS dates. */
export function validateBackup(x: unknown): BackupV1 {
  const b = x as Partial<BackupV1> | null
  if (!b || typeof b !== 'object' || b.app !== 'voki' || b.version !== 1)
    throw new Error('Das ist kein Voki-Backup (oder eine neuere Version).')
  for (const k of ['decks', 'notes', 'cards', 'logs', 'settings'] as const)
    if (!Array.isArray(b[k])) throw new Error(`Voki-Backup unvollständig: „${k}“ fehlt.`)
  if ((b.cards as Card[]).some((c) => !c || typeof c !== 'object' || !c.fsrs || !c.id))
    throw new Error('Voki-Backup beschädigt: Karten ohne Lernstand.')
  const cards = (b.cards as Card[]).map((c) => {
    const due = new Date(c.fsrs.due as unknown as string)
    return {
      ...c,
      fsrs: { ...c.fsrs, due, last_review: c.fsrs.last_review ? new Date(c.fsrs.last_review as unknown as string) : undefined },
    }
  })
  return { ...(b as BackupV1), cards }
}

/** Replaces all data atomically. */
export async function restoreBackup(db: VokiDB, b: BackupV1): Promise<void> {
  await db.transaction('rw', [db.decks, db.notes, db.cards, db.logs, db.settings], async () => {
    await Promise.all([db.decks.clear(), db.notes.clear(), db.cards.clear(), db.logs.clear(), db.settings.clear()])
    await db.decks.bulkAdd(b.decks)
    await db.notes.bulkAdd(b.notes)
    await db.cards.bulkAdd(b.cards)
    await db.logs.bulkAdd(b.logs)
    await db.settings.bulkAdd(b.settings)
  })
}
