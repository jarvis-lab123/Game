import type { VokiDB } from './db'
import type { Settings, SyncConfig } from '../lib/types'
import { mergeSnapshots, parseSnapshot, type Snapshot } from '../lib/sync/merge'
import { applySnapshot, getSyncConfig, localSnapshot, setSyncConfig } from './sync'

interface Packed { v: 1; snapshot: Snapshot; sync: SyncConfig | null; settings: Settings[] }

/**
 * One-time move of the PC app's data from its bundled origin to the web origin
 * (the PC app now loads the always-current web version). Includes the sync setup.
 */
export async function packMigration(db: VokiDB): Promise<string> {
  const packed: Packed = { v: 1, snapshot: await localSnapshot(db), sync: await getSyncConfig(db), settings: await db.settings.toArray() }
  return JSON.stringify(packed)
}

/** Merge moved data into this origin. Never deletes anything; false (and no change) on bad input. */
export async function applyMigration(db: VokiDB, text: string): Promise<boolean> {
  let p: Packed
  let incoming: Snapshot
  try {
    p = JSON.parse(text) as Packed
    if (!p || p.v !== 1 || !p.snapshot) return false
    incoming = parseSnapshot(JSON.stringify(p.snapshot)) // validates + revives dates
  } catch {
    return false
  }
  await applySnapshot(db, mergeSnapshots(await localSnapshot(db), incoming))
  if (p.sync && !(await getSyncConfig(db))) await setSyncConfig(db, p.sync)
  if (Array.isArray(p.settings) && (await db.settings.count()) === 0) await db.settings.bulkPut(p.settings)
  return true
}
