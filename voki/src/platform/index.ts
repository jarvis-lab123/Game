/** Thin platform adapter: the same UI runs in the browser (PWA) and in Tauri (Windows). */
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
export const platform: 'desktop' | 'mobile' = isTauri ? 'desktop' : 'mobile'

/**
 * Update the Windows tray tooltip („Voki – 12 fällig“). No-op outside Tauri;
 * errors are swallowed. The Tauri API is imported lazily to keep it out of the PWA startup bundle.
 */
export async function setDueBadge(count: number): Promise<void> {
  if (!isTauri) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('set_due_count', { count: Math.max(0, Math.floor(count)) })
  } catch {
    /* tray is optional */
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export function downloadFile(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function speak(text: string, lang: 'fr' | 'en' | 'de' | 'other') {
  if (!('speechSynthesis' in window) || lang === 'other') return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-GB' : 'de-DE'
  u.rate = 0.95
  speechSynthesis.cancel()
  speechSynthesis.speak(u)
}

export function vibrate(pattern: number | number[]) {
  if ('vibrate' in navigator) navigator.vibrate(pattern)
}

/* ---------- Vollbild ---------- */
type FsDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void>; webkitFullscreenEnabled?: boolean }
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }

/** Real fullscreen is possible here (Tauri window, desktop browsers, Android). Not on iPhone Safari. */
export function fullscreenSupported(): boolean {
  if (isTauri) return true
  const d = document as FsDoc
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled)
}

function domFullscreen(): boolean {
  const d = document as FsDoc
  return !!(d.fullscreenElement || d.webkitFullscreenElement)
}

async function setDomFullscreen(on: boolean): Promise<void> {
  const d = document as FsDoc
  const el = document.documentElement as FsEl
  if (on && !domFullscreen()) await (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.())
  if (!on && domFullscreen()) await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.())
}

async function tauriWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  return getCurrentWindow()
}

export async function isFullscreen(): Promise<boolean> {
  if (domFullscreen()) return true
  if (isTauri) {
    try {
      return await (await tauriWindow()).isFullscreen()
    } catch {
      return false
    }
  }
  return false
}

/**
 * Must be called from a click/key handler (browsers need a user gesture).
 * PC app: asks Windows for real fullscreen; if that is refused or has no effect,
 * falls back to the built-in browser fullscreen so the button always works.
 */
export async function setFullscreen(on: boolean): Promise<void> {
  let done = false
  if (isTauri) {
    try {
      const w = await tauriWindow()
      await w.setFullscreen(on)
      done = (await w.isFullscreen()) === on
    } catch {
      done = false
    }
    if (!on) await setDomFullscreen(false).catch(() => {})
  }
  if (!done) {
    try {
      await setDomFullscreen(on)
    } catch {
      /* refused (no gesture / not allowed): stay windowed */
    }
  }
  window.dispatchEvent(new Event('voki-fullscreen'))
}

export async function toggleFullscreen(): Promise<void> {
  await setFullscreen(!(await isFullscreen()))
}

/** Open a link in the normal browser (PC app: system browser). */
export async function openExternal(url: string): Promise<void> {
  if (isTauri) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener')
      await openUrl(url)
      return
    } catch {
      /* fall through */
    }
  }
  window.open(url, '_blank', 'noopener')
}

/** Web/PWA: look for a new version now (the page reloads itself when one is found). */
export async function checkWebUpdate(): Promise<void> {
  if (isTauri || !('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.getRegistration()
  await reg?.update()
}
