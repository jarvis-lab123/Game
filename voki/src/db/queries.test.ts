import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { VokiDB } from './db'
import { createDeck, importNotes } from './repo'
import { planDay } from './queries'

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
