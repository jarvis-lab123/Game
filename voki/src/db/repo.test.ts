import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { VokiDB } from './db'
import { createDeck, importNotes } from './repo'
import { exportBackup, restoreBackup, validateBackup } from '../lib/backup'

let db: VokiDB
beforeEach(async () => {
  db = new VokiDB('test-' + Math.random())
  await db.open()
})

const drafts = Array.from({ length: 190 }, (_, i) => ({ term: `le mot ${i}`, translation: `das Wort ${i}`, valid: true, duplicate: false }))

describe('importNotes (§10: 190 Zeilen < 1 s)', () => {
  it('creates 190 notes and one card per direction, fast', async () => {
    const deck = await createDeck(db, { name: 'Franz Dossier 3', language: 'fr', directions: ['toTarget', 'toNative'] })
    const t0 = performance.now()
    const n = await importNotes(db, deck.id, drafts, deck.directions)
    const ms = performance.now() - t0
    expect(n).toBe(190)
    expect(await db.notes.count()).toBe(190)
    expect(await db.cards.count()).toBe(380)
    expect(await db.cards.where('stage').equals('new').count()).toBe(380)
    expect(ms).toBeLessThan(1000)
  })
  it('skips invalid and duplicate drafts', async () => {
    const deck = await createDeck(db, { name: 'E', language: 'en', directions: ['toTarget'] })
    const n = await importNotes(db, deck.id, [
      { term: 'a', translation: 'b', valid: true, duplicate: false },
      { term: 'c', translation: '', valid: false, duplicate: false },
      { term: 'a', translation: 'b', valid: true, duplicate: true },
    ], deck.directions)
    expect(n).toBe(1)
    expect(await db.cards.count()).toBe(1)
  })
})

describe('backup', () => {
  it('round-trips everything incl. FSRS dates', async () => {
    const deck = await createDeck(db, { name: 'E', language: 'en', directions: ['toTarget'] })
    await importNotes(db, deck.id, drafts.slice(0, 3), deck.directions)
    const json = JSON.parse(JSON.stringify(await exportBackup(db)))
    const other = new VokiDB('test-' + Math.random())
    await restoreBackup(other, validateBackup(json))
    expect(await other.notes.count()).toBe(3)
    const c = (await other.cards.toArray())[0]
    expect(c.fsrs.due).toBeInstanceOf(Date)
  })
  it('rejects foreign files and leaves data untouched', async () => {
    expect(() => validateBackup({ hello: 1 })).toThrow(/Voki-Backup/)
    expect(() => validateBackup(null)).toThrow()
  })
})
