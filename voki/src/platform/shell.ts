/**
 * PC app (Tauri) start logic.
 * The installed app ships a copy of Voki, but always switches to the live web version on
 * GitHub Pages so every update reaches the PC without a new installer.
 * Data from the bundled copy is handed over once through the Tauri app-data folder.
 */
import { isTauri } from './index'

export const LIVE_URL = 'https://jarvis-lab123.github.io/Game/voki/'
const REACHED = 'voki.liveReached'
const MOVED = 'voki.dataMoved'

export const isBundledShell = () => isTauri && !location.href.startsWith(LIVE_URL)
export const isLiveInShell = () => isTauri && location.href.startsWith(LIVE_URL)

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

async function online(): Promise<boolean> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 4000)
  try {
    await fetch(`${LIVE_URL}manifest.webmanifest?ping=${Date.now()}`, { mode: 'no-cors', cache: 'no-store', signal: ctl.signal })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

/** Bundled start page: hand data over and switch to the live version. Returns true when leaving. */
export async function switchToLive(): Promise<boolean> {
  const root = document.getElementById('root')
  if (root) root.innerHTML = '<div style="display:grid;place-items:center;height:100vh;font:600 17px Inter,system-ui,sans-serif;color:#8e8e93">Voki wird geladen …</div>'
  const isOnline = await online()
  if (!isOnline && !localStorage.getItem(REACHED)) return false // first start offline: use the bundled copy
  try {
    if (!localStorage.getItem(MOVED)) {
      const { db } = await import('../db/db')
      if ((await db.notes.count()) > 0) {
        const { packMigration } = await import('../db/migrate')
        await invoke('stash_migration', { json: await packMigration(db) })
      }
      localStorage.setItem(MOVED, '1')
    }
  } catch {
    /* never block the start; data stays in the bundled copy */
  }
  localStorage.setItem(REACHED, '1')
  location.replace(LIVE_URL)
  return true
}

/** The bundled copy was used (offline): its data must be handed over again next time. */
export function markBundledUsed() {
  localStorage.removeItem(MOVED)
}

/** Live version inside the PC app: take over data left by the bundled copy (once). */
export async function takeOverBundledData(): Promise<void> {
  try {
    const json = await invoke<string | null>('take_migration')
    if (!json) return
    const [{ db }, { applyMigration }] = await Promise.all([import('../db/db'), import('../db/migrate')])
    await applyMigration(db, json)
  } catch {
    /* nothing to take over */
  }
}

/** Version of the installed Windows shell (not the web version). */
export async function shellVersion(): Promise<string | null> {
  if (!isTauri) return null
  try {
    const { getVersion } = await import('@tauri-apps/api/app')
    return await getVersion()
  } catch {
    return null
  }
}
