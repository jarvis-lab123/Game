import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { VokiDB } from './db'
import { seedDeck, type BuiltinDeck } from './seed'
import { deleteDeck } from './repo'

const demo: BuiltinDeck = { key: 'demo', name: 'Demo', language: 'en', directions: ['toTarget', 'toNative'], examDate: '2026-11-18', tsv: 'house\tHaus\nto cite (sth)\t(etw.) anführen\tThey cite it.\t\thier' }

describe('built-in decks', () => {
  it('adds the deck once with all words and both directions', async () => {
    const db = new VokiDB('s-' + Math.random())
    expect(await seedDeck(db, demo)).toBe(true)
    expect(await seedDeck(db, demo)).toBe(false)
    expect(await db.decks.count()).toBe(1)
    expect(await db.notes.count()).toBe(2)
    expect(await db.cards.count()).toBe(4)
    expect((await db.decks.toArray())[0]).toMatchObject({ name: 'Demo', examDate: '2026-11-18', language: 'en' })
  })
  it('uses stable ids so two devices produce the same records (no duplicates after sync)', async () => {
    const a = new VokiDB('s-' + Math.random())
    const b = new VokiDB('s-' + Math.random())
    await seedDeck(a, demo)
    await seedDeck(b, demo)
    expect((await a.cards.toCollection().primaryKeys()).sort()).toEqual((await b.cards.toCollection().primaryKeys()).sort())
  })
  it('does not come back after you deleted it', async () => {
    const db = new VokiDB('s-' + Math.random())
    await seedDeck(db, demo)
    await deleteDeck(db, (await db.decks.toArray())[0].id)
    await db.meta.clear() // e.g. a fresh device that synced the deletion
    expect(await seedDeck(db, demo)).toBe(false)
    expect(await db.decks.count()).toBe(0)
  })
})
