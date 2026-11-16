import { useEffect, useState } from 'react'
import { isTauri } from '../platform'
import { Button } from './components'
import { IconImport } from './icons'

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()

/** Call once at start: browsers fire this early (Edge/Chrome on PC and Android). */
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach((l) => l())
  })
}

export function useInstall(): { canInstall: boolean; install: () => Promise<void> } {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((x) => x + 1)
    listeners.add(l)
    return () => void listeners.delete(l)
  }, [])
  const standalone = typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches
  return {
    canInstall: !!deferred && !standalone && !isTauri,
    install: async () => {
      if (!deferred) return
      await deferred.prompt()
      await deferred.userChoice.catch(() => {})
      deferred = null
      listeners.forEach((l) => l())
    },
  }
}

/** "Install as app" – no download, no Windows warning, updates itself. */
export function InstallCard() {
  const { canInstall, install } = useInstall()
  if (!canInstall) return null
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-[22px] bg-surface p-5 shadow-card">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-gradient-to-b from-[#3a8dff] to-[#0062d1] text-white"><IconImport /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-semibold">Voki als App installieren</p>
        <p className="text-[13px] text-muted">Eigenes Fenster und Startmenü-Symbol, offline, aktualisiert sich selbst. Ohne Download, ohne Windows-Warnung.</p>
      </div>
      <Button variant="primary" onClick={() => void install()}>Installieren</Button>
    </section>
  )
}
