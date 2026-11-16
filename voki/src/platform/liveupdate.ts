/**
 * Keeps a long-running Voki (PC app hidden in the tray, PWA left open) on the newest web version.
 * When the window comes back into view, it compares the loaded build with the live index.html
 * and reloads — but never in the middle of a learning session or a test.
 */
const SCRIPT_RE = /assets\/index-[\w-]+\.js/
const MIN_GAP = 2 * 60 * 1000
const DONE_KEY = 'voki.reloadedFor'

export function currentBuild(doc: Document = document): string | null {
  for (const s of Array.from(doc.querySelectorAll('script[src]'))) {
    const m = (s as HTMLScriptElement).src.match(SCRIPT_RE)
    if (m) return m[0]
  }
  return null
}

export function buildFromHtml(html: string): string | null {
  return html.match(SCRIPT_RE)?.[0] ?? null
}

/** Routes where a reload would throw away work in progress. */
export function busyRoute(hash: string): boolean {
  return /^#\/(lernen\?.*go=1|probetest\?|bloecke\?)/.test(hash)
}

let last = 0
let pending: string | null = null

async function liveBuild(): Promise<string | null> {
  try {
    // 'reload' bypasses the HTTP cache and refreshes it, so the following location.reload() gets the new page
    const r = await fetch(new URL(import.meta.env.BASE_URL, location.origin).href, { cache: 'reload' })
    if (!r.ok) return null
    return buildFromHtml(await r.text())
  } catch {
    return null
  }
}

function reloadFor(build: string) {
  if (sessionStorage.getItem(DONE_KEY) === build) return // never loop
  sessionStorage.setItem(DONE_KEY, build)
  location.reload()
}

export async function checkForNewBuild(force = false): Promise<void> {
  if (!/^https?:/.test(location.protocol)) return
  if (!force && Date.now() - last < MIN_GAP) return
  last = Date.now()
  void navigator.serviceWorker?.getRegistration().then((reg) => reg?.update()).catch(() => {})
  const mine = currentBuild()
  const live = await liveBuild()
  if (!mine || !live || mine === live) return
  if (busyRoute(location.hash)) pending = live
  else reloadFor(live)
}

/** Start watching: on focus / becoming visible, every 20 min, and after leaving a session. */
export function watchForUpdates(): () => void {
  const onShow = () => { if (document.visibilityState === 'visible') void checkForNewBuild() }
  const onHash = () => { if (pending && !busyRoute(location.hash)) reloadFor(pending) }
  window.addEventListener('focus', onShow)
  document.addEventListener('visibilitychange', onShow)
  window.addEventListener('hashchange', onHash)
  const t = setInterval(() => void checkForNewBuild(true), 20 * 60 * 1000)
  const first = setTimeout(() => void checkForNewBuild(true), 5000)
  return () => {
    window.removeEventListener('focus', onShow)
    document.removeEventListener('visibilitychange', onShow)
    window.removeEventListener('hashchange', onHash)
    clearInterval(t)
    clearTimeout(first)
  }
}
