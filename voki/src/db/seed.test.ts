import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { VokiDB } from './db'
import { refreshSentences, seedDeck, type BuiltinDeck } from './seed'
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

describe('Wörtli-Set catalog (src/data/decks.json)', () => {
  it('every catalog set is added once, with all its words', async () => {
    const { seedBuiltinDecks, CATALOG } = await import('./seed')
    const db = new VokiDB('c-' + Math.random())
    await seedBuiltinDecks(db)
    await seedBuiltinDecks(db)
    expect(await db.decks.count()).toBe(CATALOG.length)
    const voki2 = await db.decks.get('builtin-englisch-voki-2')
    expect(voki2?.name).toBe('Englisch Voki 2')
    expect(await db.notes.where('deckId').equals('builtin-englisch-voki-2').count()).toBe(222)
  })
})

describe('new sentences for sets added earlier', () => {
  it('replaces sentence, translation and gap – progress stays', async () => {
    const db = new VokiDB('s-' + Math.random())
    await seedDeck(db, { key: 'fr', name: 'F', language: 'fr', directions: ['toTarget'], tsv: 'se concentrer\tsich konzentrieren\tIl faut se concentrer.\nle chien\tder Hund\tLe chien joue.' })
    await db.notes.update('builtin-fr-n0', { mnemonic: 'meine Brücke' })
    const tsv = 'se concentrer\tsich konzentrieren\tJe me concentre bien.\t\t\tIch konzentriere mich gut.\tme concentre\nle chien\tder Hund\tLe chien joue.'
    expect(await refreshSentences(db, 'fr', tsv)).toBe(1)
    expect(await db.notes.get('builtin-fr-n0')).toMatchObject({ example: 'Je me concentre bien.', exampleTranslation: 'Ich konzentriere mich gut.', gap: 'me concentre', mnemonic: 'meine Brücke' })
    expect(await refreshSentences(db, 'fr', tsv)).toBe(0)
  })
  it('a new set gets translation and gap right away', async () => {
    const db = new VokiDB('s-' + Math.random())
    await seedDeck(db, { key: 'fr2', name: 'F', language: 'fr', directions: ['toTarget'], tsv: 'le chat\tdie Katze\tLes chats dorment.\t\t\tDie Katzen schlafen.\tchats' })
    expect(await db.notes.get('builtin-fr2-n0')).toMatchObject({ exampleTranslation: 'Die Katzen schlafen.', gap: 'chats' })
  })
})
