import { describe, it, expect } from 'vitest'
import { createEmptyCard } from 'ts-fsrs'
import type { Card, Deck, ReviewLog, Tombstone } from '../types'
import { emptySnapshot, mergeSnapshots, parseSnapshot, snapshotsEqual, type Snapshot } from './merge'

const T = (n: number) => new Date(Date.UTC(2026, 10, 1, 8, n)).toISOString()

function card(id: string, updatedAt: string, reps = 0): Card {
  const fsrs = createEmptyCard(new Date('2026-11-01T08:00:00Z'))
  return {
    id, noteId: 'n1', deckId: 'd1', direction: 'toTarget', stage: reps ? 'review' : 'new',
    fsrs: { ...fsrs, reps, due: new Date(Date.parse('2026-11-01T08:00:00Z') + reps * 86400000) },
    due: reps, leech: false, suspended: false, order: 1, updatedAt,
  }
}
function deck(id: string, updatedAt: string, name = 'D'): Deck {
  return { id, name, language: 'fr', directions: ['toTarget'], strictAccents: false, createdAt: T(0), archived: false, updatedAt }
}
function log(id: string, cardId = 'c1'): ReviewLog {
  return { id, cardId, deckId: 'd1', timestamp: T(1), mode: 'type', rating: 3, correct: true, durationMs: 1000 }
}
function tomb(table: Tombstone['table'], id: string, deletedAt: string): Tombstone {
  return { id: `${table}:${id}`, table, deletedAt }
}
function snap(p: Partial<Snapshot>): Snapshot {
  return { ...emptySnapshot(), ...p }
}

describe('mergeSnapshots', () => {
  it('keeps the newer card in both orders', () => {
    const a = snap({ cards: [card('c1', T(1), 1)] })
    const b = snap({ cards: [card('c1', T(5), 3)] })
    expect(mergeSnapshots(a, b).cards[0].updatedAt).toBe(T(5))
    expect(mergeSnapshots(b, a).cards[0].updatedAt).toBe(T(5))
  })

  it('never lets card review state go backwards', () => {
    const older = snap({ cards: [card('c1', T(2), 2)] })
    const newer = snap({ cards: [card('c1', T(3), 5)] })
    for (const m of [mergeSnapshots(older, newer), mergeSnapshots(newer, older)]) {
      expect(m.cards[0].fsrs.reps).toBe(5)
      expect(m.cards[0].stage).toBe('review')
    }
  })

  it('keeps logs from both sides (offline reviews never lost)', () => {
    const a = snap({ logs: [log('l1'), log('l2')] })
    const b = snap({ logs: [log('l3'), log('l2')] })
    expect(mergeSnapshots(a, b).logs.map((l) => l.id)).toEqual(['l1', 'l2', 'l3'])
  })

  it('a delete on A removes the record on B', () => {
    const a = snap({ tombstones: [tomb('decks', 'd1', T(5)), tomb('logs', 'l1', T(0))] })
    const b = snap({ decks: [deck('d1', T(2))], logs: [log('l1')] })
    for (const m of [mergeSnapshots(a, b), mergeSnapshots(b, a)]) {
      expect(m.decks).toEqual([])
      expect(m.logs).toEqual([])
      expect(m.tombstones.map((t) => t.id)).toEqual(['decks:d1', 'logs:l1'])
    }
  })

  it('a record edited after its deletion survives and the tombstone is dropped', () => {
    const a = snap({ tombstones: [tomb('decks', 'd1', T(3))] })
    const b = snap({ decks: [deck('d1', T(4), 'Neu')] })
    for (const m of [mergeSnapshots(a, b), mergeSnapshots(b, a)]) {
      expect(m.decks.map((d) => d.name)).toEqual(['Neu'])
      expect(m.tombstones).toEqual([])
    }
  })

  it('keeps the newest tombstone', () => {
    const a = snap({ tombstones: [tomb('decks', 'd1', T(3))] })
    const b = snap({ tombstones: [tomb('decks', 'd1', T(6))] })
    expect(mergeSnapshots(a, b).tombstones[0].deletedAt).toBe(T(6))
    expect(mergeSnapshots(b, a).tombstones[0].deletedAt).toBe(T(6))
  })

  it('is commutative and idempotent', () => {
    const a = snap({
      decks: [deck('d2', T(1)), deck('d1', T(2), 'A')],
      cards: [card('c2', T(1)), card('c1', T(9), 4)],
      logs: [log('l9'), log('l1')],
      tombstones: [tomb('cards', 'c3', T(4))],
    })
    const b = snap({
      decks: [deck('d1', T(2), 'B'), deck('d3', T(3))],
      cards: [card('c1', T(4), 2), card('c3', T(2))],
      logs: [log('l2')],
      tombstones: [tomb('decks', 'd2', T(8))],
    })
    const ab = mergeSnapshots(a, b)
    const ba = mergeSnapshots(b, a)
    expect(ab).toEqual(ba)
    expect(mergeSnapshots(ab, ab)).toEqual(ab)
    expect(mergeSnapshots(ab, a)).toEqual(ab)
    expect(mergeSnapshots(b, ab)).toEqual(ab)
    expect(ab.decks.map((d) => d.id)).toEqual(['d1', 'd3'])
    expect(ab.cards.map((c) => c.id)).toEqual(['c1', 'c2'])
  })
})

describe('snapshotsEqual', () => {
  it('ignores order and detects changes', () => {
    const a = snap({ cards: [card('c1', T(1)), card('c2', T(1))], logs: [log('l1')] })
    const b = snap({ cards: [card('c2', T(1)), card('c1', T(1))], logs: [log('l1')] })
    expect(snapshotsEqual(a, b)).toBe(true)
    expect(snapshotsEqual(a, snap({ ...b, cards: [card('c2', T(1)), card('c1', T(2))] }))).toBe(false)
    expect(snapshotsEqual(a, snap({ ...b, logs: [] }))).toBe(false)
    expect(snapshotsEqual(a, snap({ ...b, tombstones: [tomb('notes', 'x', T(1))] }))).toBe(false)
  })
})

describe('parseSnapshot', () => {
  it('revives card dates and rejects garbage', () => {
    const s = snap({ cards: [card('c1', T(1), 2)] })
    const back = parseSnapshot(JSON.stringify(s))
    expect(back.cards[0].fsrs.due).toBeInstanceOf(Date)
    expect(back).toEqual(s)
    expect(() => parseSnapshot('{nope')).toThrow()
    expect(() => parseSnapshot('{"v":2}')).toThrow()
  })
})

describe('cascade deletes (review #2)', () => {
  const note = (id: string, updatedAt: string, deckId = 'd1') => ({ id, deckId, term: 'x', translation: 'y', tags: [], updatedAt })
  it('a card reviewed on B after its word was deleted on A does not survive as an orphan', () => {
    const a = snap({ tombstones: [tomb('notes', 'n1', T(5)), tomb('cards', 'c1', T(5))] })
    const b = snap({ notes: [note('n1', T(0))], cards: [card('c1', T(9), 2)] })
    for (const m of [mergeSnapshots(a, b), mergeSnapshots(b, a)]) {
      expect(m.notes).toEqual([])
      expect(m.cards).toEqual([])
      const t = m.tombstones.find((x) => x.id === 'cards:c1')!
      expect(t.deletedAt >= T(9)).toBe(true) // stays deleted on the next sync too
    }
  })
  it('words of a deleted deck go too', () => {
    const a = snap({ tombstones: [tomb('decks', 'd1', T(5))] })
    const b = snap({ decks: [deck('d1', T(0))], notes: [note('n1', T(7))] })
    expect(mergeSnapshots(a, b).notes).toEqual([])
  })
  it('a card without any note record (not deleted) is kept', () => {
    expect(mergeSnapshots(snap({ cards: [card('c1', T(1))] }), snap({})).cards).toHaveLength(1)
  })
})
