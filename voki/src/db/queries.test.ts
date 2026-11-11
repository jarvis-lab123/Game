import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { VokiDB } from './db'
import { createDeck, importNotes } from './repo'
import { planDay, sessionCards } from './queries'

describe('planDay exam planning', () => {
  it('does not double-count words that are on the learning ladder', async () => {
    const db = new VokiDB('q-' + Math.random())
    const now = new Date('2026-11-11T10:00:00')
    const deck = await createDeck(db, { name: 'F', language: 'fr', directions: ['toTarget', 'toNative'], examDate: '2026-11-18' })
    await importNotes(db, deck.id, Array.from({ length: 10 }, (_, i) => ({ term: `le mot ${i}`, translation: `Wort ${i}`, valid: true, duplicate: false })), deck.directions)
    const before = (await planDay(db, now)).decks[0]
    expect(before.exam!.perDay).toBe(2) // ceil(10 / (7 - 2))
    // introduce one word today: both cards move to mc, one intro log
    const cards = await db.cards.toArray()
    const noteId = cards[0].noteId
    for (const c of cards.filter((c) => c.noteId === noteId)) await db.cards.put({ ...c, stage: 'mc' })
    await db.logs.add({ id: 'l1', cardId: cards[0].id, deckId: deck.id, timestamp: now.toISOString(), mode: 'intro', rating: 0, correct: true, durationMs: 1 })
    const after = (await planDay(db, now)).decks[0]
    expect(after.exam!.perDay).toBe(2)
    expect(after.newToday).toBe(1)
    expect(after.unintroduced).toBe(9)
  })
})

describe('planDay edge cases (review #2, #5)', () => {
  it('a direction added later is scheduled', async () => {
    const db = new VokiDB('q-' + Math.random())
    const now = new Date('2026-11-11T10:00:00')
    const deck = await createDeck(db, { name: 'E', language: 'en', directions: ['toNative'] })
    await importNotes(db, deck.id, [{ term: 'house', translation: 'Haus', valid: true, duplicate: false }], deck.directions)
    const [c] = await db.cards.toArray()
    await db.cards.put({ ...c, stage: 'review', due: now.getTime() + 5 * 86400000 })
    await db.decks.put({ ...deck, directions: ['toNative', 'toTarget'] })
    const { syncDirections } = await import('./repo')
    await syncDirections(db, { ...deck, directions: ['toNative', 'toTarget'] })
    const plan = await planDay(db, now)
    const { fresh } = sessionCards(plan, now)
    expect(fresh.map((x) => x.direction)).toEqual(['toTarget'])
  })
  it('words imported 2 days before the exam can still be learned', async () => {
    const db = new VokiDB('q-' + Math.random())
    const now = new Date('2026-11-16T10:00:00')
    const deck = await createDeck(db, { name: 'E', language: 'en', directions: ['toTarget'], examDate: '2026-11-18' })
    await importNotes(db, deck.id, Array.from({ length: 5 }, (_, i) => ({ term: `w${i}`, translation: `W${i}`, valid: true, duplicate: false })), deck.directions)
    const p = (await planDay(db, now)).decks[0]
    expect(p.newToday).toBe(5)
    expect(p.exam!.warning).toBe(true)
  })
  it('cards of a removed direction are not scheduled', async () => {
    const db = new VokiDB('q-' + Math.random())
    const now = new Date('2026-11-11T10:00:00')
    const deck = await createDeck(db, { name: 'E', language: 'en', directions: ['toNative', 'toTarget'] })
    await importNotes(db, deck.id, [{ term: 'house', translation: 'Haus', valid: true, duplicate: false }], deck.directions)
    for (const c of await db.cards.toArray()) await db.cards.put({ ...c, stage: 'review', due: now.getTime() - 1000 })
    await db.decks.put({ ...deck, directions: ['toNative'] })
    const p = (await planDay(db, now)).decks[0]
    expect(p.due).toBe(1)
  })
})
