import type { Card, Deck, Note, ReviewLog, SyncTable, TestResult, Tombstone } from '../types'

export interface Snapshot {
  v: 1
  decks: Deck[]
  notes: Note[]
  cards: Card[]
  logs: ReviewLog[]
  tests: TestResult[]
  tombstones: Tombstone[]
}

type Versioned = { id: string; updatedAt: string }
const VERSIONED = ['decks', 'notes', 'cards', 'tests'] as const

export function emptySnapshot(): Snapshot {
  return { v: 1, decks: [], notes: [], cards: [], logs: [], tests: [], tombstones: [] }
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** Deterministic winner: newer key wins; on a tie, the lexically larger JSON (keeps merge commutative). */
function pick<T>(x: T, y: T, key: (r: T) => string): T {
  const kx = key(x), ky = key(y)
  if (kx !== ky) return kx > ky ? x : y
  const jx = JSON.stringify(x), jy = JSON.stringify(y)
  return jx >= jy ? x : y
}

function unionBy<T extends { id: string }>(a: T[], b: T[], key: (r: T) => string): Map<string, T> {
  const m = new Map<string, T>()
  for (const r of [...a, ...b]) {
    const cur = m.get(r.id)
    m.set(r.id, cur ? pick(cur, r, key) : r)
  }
  return m
}

/**
 * Per table and id the record with the newer `updatedAt` wins; logs are a union.
 * Tombstones delete records not edited after the deletion; a record edited later survives
 * and its tombstone is dropped. Commutative and idempotent; output sorted by id.
 */
export function mergeSnapshots(a: Snapshot, b: Snapshot): Snapshot {
  const tombs = unionBy(a.tombstones, b.tombstones, (t) => t.deletedAt)
  const out = emptySnapshot()

  for (const table of VERSIONED) {
    const merged = unionBy<Versioned>(a[table] as Versioned[], b[table] as Versioned[], (r) => r.updatedAt)
    const keep: Versioned[] = []
    for (const r of merged.values()) {
      const tid = `${table}:${r.id}`
      const t = tombs.get(tid)
      if (t && t.deletedAt >= r.updatedAt) continue
      if (t) tombs.delete(tid)
      keep.push(r)
    }
    ;(out[table] as Versioned[]) = keep.sort(byId)
  }

  // Cascade: rows whose parent was deleted (and is gone) disappear too, even if edited later.
  // Their tombstone gets the newest timestamp so the next sync does not bring them back.
  const cascade = (table: 'notes' | 'cards', parentTable: 'decks' | 'notes', parentOf: (r: Versioned) => string) => {
    const alive = new Set((out[parentTable] as Versioned[]).map((r) => r.id))
    const keep: Versioned[] = []
    for (const r of out[table] as Versioned[]) {
      const pid = parentOf(r)
      if (!alive.has(pid) && tombs.has(`${parentTable}:${pid}`)) {
        const tid = `${table}:${r.id}`
        const old = tombs.get(tid)
        const deletedAt = old && old.deletedAt > r.updatedAt ? old.deletedAt : r.updatedAt
        tombs.set(tid, { id: tid, table, deletedAt })
      } else keep.push(r)
    }
    ;(out[table] as Versioned[]) = keep
  }
  cascade('notes', 'decks', (r) => (r as unknown as { deckId: string }).deckId)
  cascade('cards', 'notes', (r) => (r as unknown as { noteId: string }).noteId)

  const logs = unionBy(a.logs, b.logs, (l) => l.timestamp)
  out.logs = [...logs.values()].filter((l) => !tombs.has(`logs:${l.id}`)).sort(byId)
  out.tombstones = [...tombs.values()].sort(byId)
  return out
}

function signature(s: Snapshot): string {
  const part = (rows: { id: string }[], key: (r: never) => string) =>
    rows.map((r) => `${r.id}@${key(r as never)}`).sort().join(',')
  const v = (r: Versioned) => r.updatedAt
  return [
    part(s.decks, v), part(s.notes, v), part(s.cards, v), part(s.tests, v),
    part(s.logs, (l: ReviewLog) => l.timestamp),
    part(s.tombstones, (t: Tombstone) => t.deletedAt),
  ].join('|')
}

/** Cheap comparison of ids and versions (not full contents). */
export function snapshotsEqual(a: Snapshot, b: Snapshot): boolean {
  return signature(a) === signature(b)
}

/** JSON turns FSRS dates into strings; turn them back into Date objects. */
export function reviveCard(c: Card): Card {
  return {
    ...c,
    fsrs: {
      ...c.fsrs,
      due: new Date(c.fsrs.due as unknown as string),
      last_review: c.fsrs.last_review ? new Date(c.fsrs.last_review as unknown as string) : undefined,
    },
  }
}

const TABLES: (SyncTable | 'tombstones')[] = ['decks', 'notes', 'cards', 'logs', 'tests', 'tombstones']

/** Parses and validates a snapshot (throws on garbage). Revives card dates. */
export function parseSnapshot(text: string): Snapshot {
  const x = JSON.parse(text) as Partial<Snapshot> | null
  if (!x || typeof x !== 'object' || x.v !== 1) throw new Error('Unbekanntes Sync-Format.')
  for (const k of TABLES) if (!Array.isArray(x[k])) throw new Error(`Sync-Daten unvollständig: ${k}`)
  const s = x as Snapshot
  if (s.cards.some((c) => !c || typeof c !== 'object' || !c.id || !c.fsrs)) throw new Error('Sync-Daten: Karten ohne Lernstand.')
  for (const k of TABLES) if ((s[k] as { id?: unknown }[]).some((r) => !r || typeof r.id !== 'string')) throw new Error(`Sync-Daten: ${k} ohne id.`)
  return { v: 1, decks: s.decks, notes: s.notes, cards: s.cards.map(reviveCard), logs: s.logs, tests: s.tests, tombstones: s.tombstones }
}
