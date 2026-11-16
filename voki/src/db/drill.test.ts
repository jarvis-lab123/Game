import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { VokiDB } from './db'
import { createDeck, importNotes } from './repo'
import { drillCards, clearOverconfident } from './drill'

async function setup() {
  const db = new VokiDB('d-' + Math.random())
  const deck = await createDeck(db, { name: 'F', language: 'fr', directions: ['toTarget'] })
  await importNotes(db, deck.id, ['a', 'b', 'c'].map((t) => ({ term: t, translation: t.toUpperCase(), valid: true, duplicate: false })), deck.directions)
  const notes = await db.notes.toArray()
  const cards = await db.cards.toArray()
  return { db, deck, notes, cards }
}

describe('drillCards – Fehlerheft drill takes what the Fehlerheft lists (review #3)', () => {
  it('includes overconfident words still on the learning ladder', async () => {
    const { db, notes, cards } = await setup()
    const n = notes[0]
    await db.notes.put({ ...n, tags: ['überschätzt'] })
    await db.cards.put({ ...cards.find((c) => c.noteId === n.id)!, stage: 'mc' })
    expect((await drillCards(db, 10)).map((c) => c.noteId)).toEqual([n.id])
  })
  it('includes recent wrong answers at any stage (the Fehlerheft lists them too), not untouched words', async () => {
    const { db, deck, cards } = await setup()
    await db.cards.put({ ...cards[1], stage: 'type' })
    for (const c of [cards[1], cards[2]]) await db.logs.add({ id: 'l' + c.id, cardId: c.id, deckId: deck.id, timestamp: new Date().toISOString(), mode: 'test', rating: 0, correct: false, durationMs: 0 })
    expect((await drillCards(db, 10)).map((c) => c.id).sort()).toEqual([cards[1].id, cards[2].id].sort())
    expect((await drillCards(db, 10)).map((c) => c.id)).not.toContain(cards[0].id) // never touched
  })
  it('clearOverconfident removes the tag', async () => {
    const { db, notes } = await setup()
    await db.notes.put({ ...notes[0], tags: ['überschätzt', 'x'] })
    await clearOverconfident(db, notes[0].id)
    expect((await db.notes.get(notes[0].id))!.tags).toEqual(['x'])
  })
})
