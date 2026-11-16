import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { VokiDB } from './db'
import { createDeck, importNotes } from './repo'
import { applyBlockTest, introduceBlock } from './blocks'

async function setup() {
  const db = new VokiDB('b-' + Math.random())
  const deck = await createDeck(db, { name: 'E', language: 'en', directions: ['toTarget', 'toNative'] })
  await importNotes(db, deck.id, ['a', 'b'].map((t) => ({ term: t, translation: t.toUpperCase(), valid: true, duplicate: false })), deck.directions)
  const cards = await db.cards.toArray()
  const target = cards.filter((c) => c.direction === 'toTarget')
  return { db, cards, target }
}

describe('block learning feeds the progress', () => {
  it('reading a block introduces its words (both directions)', async () => {
    const { db, target } = await setup()
    await introduceBlock(db, [target[0].id])
    const all = await db.cards.where('noteId').equals(target[0].noteId).toArray()
    expect(all.map((c) => c.stage)).toEqual(['mc', 'mc'])
    const other = await db.cards.where('noteId').equals(target[1].noteId).toArray()
    expect(other.every((c) => c.stage === 'new')).toBe(true)
  })
  it('right in the test → learned (with the sibling), wrong → still to learn', async () => {
    const { db, target } = await setup()
    await applyBlockTest(db, [{ cardId: target[0].id, correct: true }, { cardId: target[1].id, correct: false }], 0.9)
    const right = await db.cards.where('noteId').equals(target[0].noteId).toArray()
    expect(right.every((c) => c.stage === 'review' && c.fsrs.reps === 1)).toBe(true)
    const wrong = await db.cards.where('noteId').equals(target[1].noteId).toArray()
    expect(wrong.find((c) => c.id === target[1].id)!.stage).toBe('type')
    expect(wrong.find((c) => c.id !== target[1].id)!.stage).toBe('mc')
  })
  it('wrong on a learned card → lapse', async () => {
    const { db, target } = await setup()
    await applyBlockTest(db, [{ cardId: target[0].id, correct: true }], 0.9, new Date('2026-11-01'))
    await applyBlockTest(db, [{ cardId: target[0].id, correct: false }], 0.9, new Date('2026-11-10'))
    const c = await db.cards.get(target[0].id)
    expect(c!.stage).toBe('review')
    expect(c!.fsrs.lapses).toBe(1)
  })
})
