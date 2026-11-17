import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { VokiDB } from './db'
import { createDeck, importNotes } from './repo'
import { log } from './queries'
import { errorCandidates, newCandidates, trainerCandidates } from './trainer'

async function setup() {
  const db = new VokiDB('t-' + Math.random())
  const deck = await createDeck(db, { name: 'E', language: 'en', directions: ['toTarget', 'toNative'] })
  await importNotes(db, deck.id, ['a', 'b', 'c'].map((t) => ({ term: t, translation: t.toUpperCase(), valid: true, duplicate: false })), deck.directions)
  const cards = await db.cards.toArray()
  return { db, deck, cards }
}

describe('trainer word sources', () => {
  it('new words: only never-started ones, written direction, in list order', async () => {
    const { db, cards } = await setup()
    const started = cards.find((c) => c.direction === 'toNative')!
    await db.cards.put({ ...started, stage: 'mc' })
    const fresh = await newCandidates(db)
    expect(fresh.every((p) => p.card.direction === 'toTarget')).toBe(true)
    expect(fresh.map((p) => p.note.id)).not.toContain(started.noteId)
    expect(fresh).toHaveLength(2)
  })
  it('all errors: every word answered wrong, nothing else', async () => {
    const { db, deck, cards } = await setup()
    for (const c of cards.filter((c) => c.direction === 'toTarget')) await db.cards.put({ ...c, stage: 'mc' })
    const t = cards.filter((c) => c.direction === 'toTarget')
    await log(db, { cardId: t[0].id, deckId: deck.id, timestamp: new Date().toISOString(), mode: 'type', rating: 1, correct: false, durationMs: 1000 })
    await log(db, { cardId: t[1].id, deckId: deck.id, timestamp: new Date().toISOString(), mode: 'test', rating: 0, correct: false, durationMs: 0 })
    const errs = await errorCandidates(db)
    expect(errs.map((p) => p.note.id).sort()).toEqual([t[0].noteId, t[1].noteId].sort())
    expect(errs[0].note.id).toBe(t[1].noteId) // test mistakes weigh double
    expect((await trainerCandidates(db)).length).toBeGreaterThanOrEqual(2)
  })
})
