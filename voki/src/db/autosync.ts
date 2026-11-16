import type { VokiDB } from './db'
import { getSyncConfig, syncNow } from './sync'

const INTERVAL_MS = 5 * 60 * 1000
const DEBOUNCE_MS = 2000

let current: VokiDB | null = null
let debounce: ReturnType<typeof setTimeout> | undefined

const online = () => typeof navigator === 'undefined' || navigator.onLine !== false
const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden'

/** Syncs if configured. Errors are swallowed (syncNow stores them in config.lastError). */
async function trySync(db: VokiDB): Promise<void> {
  try {
    if (!online() || !(await getSyncConfig(db))) return
    await syncNow(db)
  } catch {
    /* stored in config.lastError */
  }
}

/** Starts background sync: on start, every 5 min (online + visible), on `online`, on becoming visible. */
export function startAutoSync(db: VokiDB): () => void {
  current = db
  void trySync(db)
  const timer = setInterval(() => {
    if (online() && visible()) void trySync(db)
  }, INTERVAL_MS)
  const onOnline = () => void trySync(db)
  const onVisible = () => {
    if (visible()) void trySync(db)
  }
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    clearInterval(timer)
    clearTimeout(debounce)
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
    if (current === db) current = null
  }
}

/** Call after a learning session; debounced 2 s. No-op if auto sync is not started. */
export function requestSync(): void {
  const db = current
  if (!db) return
  clearTimeout(debounce)
  debounce = setTimeout(() => void trySync(db), DEBOUNCE_MS)
}
