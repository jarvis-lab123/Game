import type { Table } from 'dexie'
import type { VokiDB } from './db'
import type { SyncConfig, Tombstone } from '../lib/types'
import { emptySnapshot, mergeSnapshots, parseSnapshot, reviveCard, snapshotsEqual, type Snapshot } from '../lib/sync/merge'
import { GistClient, SyncError, encodeSyncCode, decodeSyncCode } from '../lib/sync/gist'

/** The subset of GistClient the sync needs (lets tests use an in-memory fake). */
export type GistLike = Pick<GistClient, 'create' | 'read' | 'write'>

const KEY = 'sync'

// Stored in db.meta, which is never part of a backup export (the token must not leak into backups).
export async function getSyncConfig(db: VokiDB): Promise<SyncConfig | null> {
  const row = await db.meta.get(KEY)
  const v = row?.value as SyncConfig | undefined
  return v && v.token && v.gistId ? v : null
}

export async function setSyncConfig(db: VokiDB, cfg: SyncConfig | null): Promise<void> {
  if (cfg) await db.meta.put({ key: KEY, value: cfg })
  else await db.meta.delete(KEY)
}

/** Updates status fields only if sync is still configured for the same gist. */
async function patchConfig(db: VokiDB, gistId: string, patch: Partial<SyncConfig>): Promise<void> {
  await db.transaction('rw', db.meta, async () => {
    const cur = await getSyncConfig(db)
    if (cur && cur.gistId === gistId) await setSyncConfig(db, { ...cur, ...patch })
  })
}

export async function localSnapshot(db: VokiDB): Promise<Snapshot> {
  return db.transaction('r', [db.decks, db.notes, db.cards, db.logs, db.tests, db.tombstones], async () => ({
    v: 1 as const,
    decks: await db.decks.toArray(),
    notes: await db.notes.toArray(),
    cards: await db.cards.toArray(),
    logs: await db.logs.toArray(),
    tests: await db.tests.toArray(),
    tombstones: await db.tombstones.toArray(),
  }))
}

/**
 * Writes a merged snapshot into the local DB in one transaction. Never overwrites a local record
 * that became newer meanwhile (e.g. a review during the sync), never deletes a record edited
 * after its tombstone.
 */
export async function applySnapshot(db: VokiDB, s: Snapshot): Promise<void> {
  await db.transaction('rw', [db.decks, db.notes, db.cards, db.logs, db.tests, db.tombstones], async () => {
    const tombs = new Map(s.tombstones.map((t) => [t.id, t]))
    const versioned = [
      [db.decks, s.decks, 'decks'],
      [db.notes, s.notes, 'notes'],
      [db.cards, s.cards.map(reviveCard), 'cards'],
      [db.tests, s.tests, 'tests'],
    ] as const
    const liveTombIds: string[] = []

    for (const [table, rows, name] of versioned) {
      const t = table as unknown as Table<{ id: string; updatedAt: string }, string>
      const tombIds = s.tombstones.filter((x) => x.table === name).map((x) => x.id.slice(name.length + 1))
      const ids = [...rows.map((r) => r.id), ...tombIds]
      const existing = new Map<string, string>()
      for (const r of await t.bulkGet(ids)) if (r) existing.set(r.id, r.updatedAt)

      const put = (rows as { id: string; updatedAt: string }[]).filter((r) => {
        const cur = existing.get(r.id)
        return cur === undefined || cur <= r.updatedAt
      })
      await t.bulkPut(put)
      // A record that exists in the merge outlived any older tombstone.
      liveTombIds.push(...rows.map((r) => `${name}:${r.id}`).filter((id) => !tombs.has(id)))

      const del = tombIds.filter((id) => {
        const cur = existing.get(id)
        return cur !== undefined && cur <= tombs.get(`${name}:${id}`)!.deletedAt
      })
      await t.bulkDelete(del)
    }

    await db.logs.bulkPut(s.logs.filter((l) => !tombs.has(`logs:${l.id}`)))
    await db.logs.bulkDelete(s.tombstones.filter((t) => t.table === 'logs').map((t) => t.id.slice(5)))

    await db.tombstones.bulkDelete(liveTombIds)
    const curTombs = new Map((await db.tombstones.bulkGet(s.tombstones.map((t) => t.id))).filter((t): t is Tombstone => !!t).map((t) => [t.id, t]))
    await db.tombstones.bulkPut(s.tombstones.filter((t) => {
      const cur = curTombs.get(t.id)
      return !cur || cur.deletedAt <= t.deletedAt
    }))
  })
}

const running = new WeakMap<VokiDB, Promise<{ changed: boolean }>>()

/** Merges local data with the gist. Throws SyncError; the message is also stored in config.lastError. */
export function syncNow(db: VokiDB, client?: GistLike): Promise<{ changed: boolean }> {
  const cur = running.get(db)
  if (cur) return cur
  const p = runSync(db, client).finally(() => running.delete(db))
  running.set(db, p)
  return p
}

async function runSync(db: VokiDB, client?: GistLike): Promise<{ changed: boolean }> {
  const cfg = await getSyncConfig(db)
  if (!cfg) throw new SyncError('notfound', 'Sync ist nicht eingeschaltet.')
  const gist = client ?? new GistClient(cfg.token)
  try {
    const text = await gist.read(cfg.gistId)
    let remote: Snapshot
    if (text === null) remote = emptySnapshot()
    else {
      try {
        remote = parseSnapshot(text)
      } catch {
        throw new SyncError('server', 'Sync-Daten auf GitHub sind beschädigt.')
      }
    }
    const local = await localSnapshot(db)
    const merged = mergeSnapshots(local, remote)
    const changed = !snapshotsEqual(merged, local)
    if (changed) await applySnapshot(db, merged)
    if (text === null || !snapshotsEqual(merged, remote)) await gist.write(cfg.gistId, JSON.stringify(merged))
    await patchConfig(db, cfg.gistId, { lastSyncAt: new Date().toISOString(), lastError: undefined })
    return { changed }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await patchConfig(db, cfg.gistId, { lastError: message }).catch(() => {})
    throw e instanceof SyncError ? e : new SyncError('server', message)
  }
}

/** Creates the gist from the current local data, stores the config and returns the sync code. */
export async function enableSync(db: VokiDB, token: string, client?: GistLike): Promise<string> {
  const t = token.trim()
  if (!t) throw new Error('Bitte füge zuerst einen Token ein.')
  const gist = client ?? new GistClient(t)
  const gistId = await gist.create(JSON.stringify(await localSnapshot(db)))
  await setSyncConfig(db, { token: t, gistId, lastSyncAt: new Date().toISOString() })
  return encodeSyncCode({ token: t, gistId })
}

/** Connects this device to an existing sync and merges (local data is never wiped). */
export async function joinSync(db: VokiDB, code: string, client?: GistLike): Promise<{ changed: boolean }> {
  const { token, gistId } = decodeSyncCode(code)
  const prev = await getSyncConfig(db)
  await setSyncConfig(db, { token, gistId })
  try {
    return await syncNow(db, client ?? new GistClient(token))
  } catch (e) {
    // A wrong code should not leave a broken config behind.
    if (e instanceof SyncError && (e.kind === 'auth' || e.kind === 'notfound')) await setSyncConfig(db, prev)
    throw e
  }
}

export function syncCodeFor(cfg: SyncConfig): string {
  return encodeSyncCode(cfg)
}
