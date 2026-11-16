import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { createEmptyCard } from 'ts-fsrs'
import { VokiDB } from './db'
import { createDeck, importNotes, addTombstones } from './repo'
import { applySnapshot, enableSync, getSyncConfig, joinSync, localSnapshot, setSyncConfig, syncNow, type GistLike } from './sync'
import { SyncError } from '../lib/sync/gist'
import { exportBackup } from '../lib/backup'
import type { ReviewLog } from '../lib/types'

/** One in-memory gist shared by all devices. */
class FakeGist implements GistLike {
  files = new Map<string, string>()
  writes = 0
  async create(content: string) {
    const id = 'g' + (this.files.size + 1)
    this.files.set(id, content)
    return id
  }
  async read(id: string) {
    if (!this.files.has(id)) throw new SyncError('notfound', 'Sync-Gist nicht gefunden.')
    return this.files.get(id) || null
  }
  async write(id: string, content: string) {
    this.writes++
    this.files.set(id, content)
  }
}

let clock = Date.now() + 60_000
const tick = () => new Date((clock += 1000)).toISOString()

async function learn(db: VokiDB, cardId: string, reps: number): Promise<ReviewLog> {
  const c = (await db.cards.get(cardId))!
  const due = new Date(clock + reps * 86400000)
  await db.cards.put({ ...c, stage: 'review', due: due.getTime(), fsrs: { ...c.fsrs, reps, due, last_review: new Date(clock) }, updatedAt: tick() })
  const log: ReviewLog = { id: crypto.randomUUID(), cardId, deckId: c.deckId, timestamp: tick(), mode: 'type', rating: 3, correct: true, durationMs: 900 }
  await db.logs.add(log)
  return log
}

let A: VokiDB, B: VokiDB, gist: FakeGist
beforeEach(async () => {
  A = new VokiDB('A-' + Math.random())
  B = new VokiDB('B-' + Math.random())
  await A.open()
  await B.open()
  gist = new FakeGist()
})

describe('sync config', () => {
  it('lives in meta and never ends up in a backup', async () => {
    expect(await getSyncConfig(A)).toBeNull()
    await setSyncConfig(A, { token: 'secret', gistId: 'g' })
    expect(await getSyncConfig(A)).toEqual({ token: 'secret', gistId: 'g' })
    expect(JSON.stringify(await exportBackup(A))).not.toContain('secret')
    await setSyncConfig(A, null)
    expect(await getSyncConfig(A)).toBeNull()
  })
})

describe('two devices, one gist', () => {
  it('never loses reviews and the newer card wins', async () => {
    const deck = await createDeck(A, { name: 'Franz', language: 'fr', directions: ['toTarget'] })
    await importNotes(A, deck.id, [{ term: 'le chat', translation: 'die Katze', valid: true, duplicate: false }, { term: 'le chien', translation: 'der Hund', valid: true, duplicate: false }], deck.directions)
    const [c1, c2] = (await A.cards.toArray()).map((c) => c.id)
    const code = await enableSync(A, ' ghp_token ', gist)
    expect(code).toMatch(/^VOKI1-/)

    // B already has its own data: joining must merge, not wipe.
    const own = await createDeck(B, { name: 'Englisch', language: 'en', directions: ['toTarget'] })
    expect(await joinSync(B, code, gist)).toEqual({ changed: true })
    expect(await B.decks.count()).toBe(2)
    expect(await B.cards.count()).toBe(2)

    // A learns, syncs; B syncs and gets A's log and newer card.
    const l1 = await learn(A, c1, 3)
    await syncNow(A, gist)
    await syncNow(B, gist)
    expect(await B.logs.get(l1.id)).toBeTruthy()
    const bc1 = (await B.cards.get(c1))!
    expect(bc1.fsrs.reps).toBe(3)
    expect(bc1.fsrs.due).toBeInstanceOf(Date)
    expect(await A.decks.get(own.id)).toBeTruthy()

    // Both learn offline, then both sync twice.
    const lb = await learn(B, c2, 1)
    const la = await learn(A, c1, 5)
    for (let i = 0; i < 2; i++) {
      await syncNow(A, gist)
      await syncNow(B, gist)
    }
    for (const db of [A, B]) {
      expect((await db.logs.toArray()).map((l) => l.id).sort()).toEqual([l1.id, lb.id, la.id].sort())
      expect((await db.cards.get(c1))!.fsrs.reps).toBe(5)
      expect((await db.cards.get(c2))!.fsrs.reps).toBe(1)
    }
    // Steady state: nothing changes, nothing is written.
    const w = gist.writes
    expect(await syncNow(A, gist)).toEqual({ changed: false })
    expect(await syncNow(B, gist)).toEqual({ changed: false })
    expect(gist.writes).toBe(w)
    expect((await getSyncConfig(B))!.lastSyncAt).toBeTruthy()
  })

  it('propagates deletions', async () => {
    const deck = await createDeck(A, { name: 'D', language: 'fr', directions: ['toTarget'] })
    const code = await enableSync(A, 't', gist)
    await joinSync(B, code, gist)
    expect(await B.decks.get(deck.id)).toBeTruthy()
    await A.decks.delete(deck.id)
    await addTombstones(A, 'decks', [deck.id])
    await syncNow(A, gist)
    await syncNow(B, gist)
    expect(await B.decks.get(deck.id)).toBeUndefined()
    expect(await B.tombstones.get(`decks:${deck.id}`)).toBeTruthy()
  })

  it('does not touch local data when the gist is corrupt', async () => {
    await createDeck(A, { name: 'D', language: 'fr', directions: ['toTarget'] })
    await enableSync(A, 't', gist)
    gist.files.set('g1', '{kaputt')
    const before = await localSnapshot(A)
    await expect(syncNow(A, gist)).rejects.toMatchObject({ kind: 'server', message: 'Sync-Daten auf GitHub sind beschädigt.' })
    expect(await localSnapshot(A)).toEqual(before)
    expect((await getSyncConfig(A))!.lastError).toBe('Sync-Daten auf GitHub sind beschädigt.')
    expect(gist.files.get('g1')).toBe('{kaputt')
  })

  it('runs only one sync at a time', async () => {
    await enableSync(A, 't', gist)
    const p1 = syncNow(A, gist)
    const p2 = syncNow(A, gist)
    expect(p1).toBe(p2)
    await p1
  })

  it('joinSync with an unknown gist keeps no broken config', async () => {
    const { encodeSyncCode } = await import('../lib/sync/gist')
    await expect(joinSync(B, encodeSyncCode({ token: 't', gistId: 'nope' }), gist)).rejects.toMatchObject({ kind: 'notfound' })
    expect(await getSyncConfig(B)).toBeNull()
  })

  it('applySnapshot does not overwrite a newer local record', async () => {
    const deck = await createDeck(A, { name: 'Neu', language: 'fr', directions: ['toTarget'] })
    const s = await localSnapshot(A)
    s.decks = [{ ...deck, name: 'Alt', updatedAt: '2000-01-01T00:00:00.000Z' }]
    s.cards = [{ id: 'cx', noteId: 'n', deckId: deck.id, direction: 'toTarget', stage: 'new', fsrs: JSON.parse(JSON.stringify(createEmptyCard())), due: 0, leech: false, suspended: false, order: 0, updatedAt: tick() }]
    await applySnapshot(A, s)
    expect((await A.decks.get(deck.id))!.name).toBe('Neu')
    expect((await A.cards.get('cx'))!.fsrs.due).toBeInstanceOf(Date)
  })
})
