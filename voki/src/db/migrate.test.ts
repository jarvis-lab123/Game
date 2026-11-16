import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { VokiDB } from './db'
import { createDeck, importNotes } from './repo'
import { exportBackup } from '../lib/backup'
import { getSyncConfig, setSyncConfig } from './sync'
import { packMigration, applyMigration } from './migrate'

async function deviceWithWords(name: string, words: string[]) {
  const db = new VokiDB(name + Math.random())
  const deck = await createDeck(db, { name: 'E', language: 'en', directions: ['toTarget'] })
  await importNotes(db, deck.id, words.map((w) => ({ term: w, translation: w.toUpperCase(), valid: true, duplicate: false })), deck.directions)
  return { db, deck }
}

describe('moving the PC app data from the bundled app to the web origin', () => {
  it('an empty new origin receives everything, including the sync setup', async () => {
    const { db: old } = await deviceWithWords('old', ['a', 'b'])
    await old.logs.add({ id: 'l1', cardId: (await old.cards.toArray())[0].id, deckId: 'x', timestamp: new Date().toISOString(), mode: 'type', rating: 3, correct: true, durationMs: 1 })
    await setSyncConfig(old, { token: 't', gistId: 'g' })
    const packed = await packMigration(old)
    const fresh = new VokiDB('new' + Math.random())
    expect(await applyMigration(fresh, packed)).toBe(true)
    expect(await fresh.notes.count()).toBe(2)
    expect(await fresh.logs.count()).toBe(1)
    expect(await getSyncConfig(fresh)).toMatchObject({ token: 't', gistId: 'g' })
  })
  it('merges into an origin that already has data – nothing is lost on either side', async () => {
    const { db: old } = await deviceWithWords('old', ['a'])
    const { db: web } = await deviceWithWords('web', ['z'])
    expect(await applyMigration(web, await packMigration(old))).toBe(true)
    expect((await web.notes.toArray()).map((n) => n.term).sort()).toEqual(['a', 'z'])
  })
  it('ignores garbage without touching data', async () => {
    const { db: web } = await deviceWithWords('web', ['z'])
    expect(await applyMigration(web, '{"nope":1}')).toBe(false)
    expect(await applyMigration(web, 'not json')).toBe(false)
    expect(await web.notes.count()).toBe(1)
  })
  it('the backup inside does not contain the token', async () => {
    const { db: old } = await deviceWithWords('old', ['a'])
    await setSyncConfig(old, { token: 'secret-token', gistId: 'g' })
    expect(JSON.stringify(await exportBackup(old))).not.toContain('secret-token')
  })
})
