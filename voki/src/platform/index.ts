/** Thin platform adapter: the same UI runs in the browser (PWA) and in Tauri (Windows). */
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
export const platform: 'desktop' | 'mobile' = isTauri ? 'desktop' : 'mobile'

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
